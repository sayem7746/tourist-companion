import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ConflictError, ValidationError } from '../errors.js';
import { applyContentPatch, rowFromCreate } from './map.js';
import type {
  ContentAirportCode,
  ContentItem,
  ContentKind,
  ContentListFilters,
  ContentStore,
} from './types.js';

interface ContentRow {
  id: string;
  slug: string;
  kind: ContentKind;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  area: string | null;
  airportCode: ContentAirportCode | null;
  topic: string | null;
  whenToUse: string | null;
  icon: string | null;
  steps: string[];
  sortOrder: number;
  published: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const SELECT_ITEM = `
  SELECT
    id,
    slug,
    kind,
    title,
    summary,
    body,
    tags,
    area,
    airport_code AS "airportCode",
    topic,
    when_to_use AS "whenToUse",
    icon,
    steps,
    sort_order AS "sortOrder",
    published,
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM content_items
`;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: ContentRow): ContentItem {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    body: row.body,
    tags: [...(row.tags ?? [])],
    area: row.area,
    airportCode: row.airportCode,
    topic: row.topic,
    whenToUse: row.whenToUse,
    icon: row.icon,
    steps: [...(row.steps ?? [])],
    sortOrder: row.sortOrder,
    published: row.published,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}

function isCheckViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23514'
  );
}

function mapDbError(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new ConflictError('A content item with this slug already exists');
  }
  if (isCheckViolation(error)) {
    throw new ValidationError('Content item failed a database constraint');
  }
  throw error;
}

export function createPgContentStore(pool: pg.Pool): ContentStore {
  return {
    async list(filters?: ContentListFilters) {
      const values: unknown[] = [];
      const clauses: string[] = [];
      if (filters?.kind) {
        values.push(filters.kind);
        clauses.push(`kind = $${values.length}`);
      }
      if (filters?.published !== undefined) {
        values.push(filters.published);
        clauses.push(`published = $${values.length}`);
      }
      if (filters?.q?.trim()) {
        values.push(`%${filters.q.trim().toLowerCase()}%`);
        const idx = values.length;
        clauses.push(
          `(
            lower(title) LIKE $${idx}
            OR lower(summary) LIKE $${idx}
            OR lower(body) LIKE $${idx}
            OR lower(slug) LIKE $${idx}
            OR lower(coalesce(area, '')) LIKE $${idx}
            OR lower(coalesce(topic, '')) LIKE $${idx}
            OR exists (SELECT 1 FROM unnest(tags) AS tag WHERE lower(tag) LIKE $${idx})
          )`,
        );
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const result = await pool.query<ContentRow>(
        `${SELECT_ITEM} ${where} ORDER BY kind ASC, sort_order ASC, title ASC`,
        values,
      );
      return result.rows.map(mapRow);
    },
    async get(id) {
      const result = await pool.query<ContentRow>(`${SELECT_ITEM} WHERE id = $1`, [id]);
      return result.rows[0] ? mapRow(result.rows[0]) : undefined;
    },
    async create(input) {
      const id = randomUUID();
      const item = rowFromCreate(id, input, new Date().toISOString());
      try {
        const result = await pool.query<ContentRow>(
          `
            INSERT INTO content_items (
              id, slug, kind, title, summary, body, tags, area, airport_code, topic,
              when_to_use, icon, steps, sort_order, published
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15
            )
            RETURNING
              id, slug, kind, title, summary, body, tags, area,
              airport_code AS "airportCode", topic, when_to_use AS "whenToUse", icon, steps,
              sort_order AS "sortOrder", published,
              created_at AS "createdAt", updated_at AS "updatedAt"
          `,
          [
            item.id,
            item.slug,
            item.kind,
            item.title,
            item.summary,
            item.body,
            item.tags,
            item.area,
            item.airportCode,
            item.topic,
            item.whenToUse,
            item.icon,
            item.steps,
            item.sortOrder,
            item.published,
          ],
        );
        return mapRow(result.rows[0]);
      } catch (error) {
        mapDbError(error);
      }
    },
    async update(id, patch) {
      const current = await this.get(id);
      if (!current) return undefined;
      const next = applyContentPatch(current, patch, new Date().toISOString());
      try {
        const result = await pool.query<ContentRow>(
          `
            UPDATE content_items SET
              slug = $2,
              kind = $3,
              title = $4,
              summary = $5,
              body = $6,
              tags = $7,
              area = $8,
              airport_code = $9,
              topic = $10,
              when_to_use = $11,
              icon = $12,
              steps = $13,
              sort_order = $14,
              published = $15
            WHERE id = $1
            RETURNING
              id, slug, kind, title, summary, body, tags, area,
              airport_code AS "airportCode", topic, when_to_use AS "whenToUse", icon, steps,
              sort_order AS "sortOrder", published,
              created_at AS "createdAt", updated_at AS "updatedAt"
          `,
          [
            id,
            next.slug,
            next.kind,
            next.title,
            next.summary,
            next.body,
            next.tags,
            next.area,
            next.airportCode,
            next.topic,
            next.whenToUse,
            next.icon,
            next.steps,
            next.sortOrder,
            next.published,
          ],
        );
        return result.rows[0] ? mapRow(result.rows[0]) : undefined;
      } catch (error) {
        mapDbError(error);
      }
    },
    async setPublished(id, published) {
      try {
        const result = await pool.query<ContentRow>(
          `
            UPDATE content_items SET published = $2
            WHERE id = $1
            RETURNING
              id, slug, kind, title, summary, body, tags, area,
              airport_code AS "airportCode", topic, when_to_use AS "whenToUse", icon, steps,
              sort_order AS "sortOrder", published,
              created_at AS "createdAt", updated_at AS "updatedAt"
          `,
          [id, published],
        );
        return result.rows[0] ? mapRow(result.rows[0]) : undefined;
      } catch (error) {
        mapDbError(error);
      }
    },
    async delete(id) {
      const result = await pool.query(`DELETE FROM content_items WHERE id = $1`, [id]);
      return (result.rowCount ?? 0) > 0;
    },
  };
}
