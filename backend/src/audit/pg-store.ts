import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type {
  AuditAction,
  AuditActorType,
  AuditEntityType,
  AuditEvent,
  AuditListFilters,
  AuditListResult,
  AuditMetadata,
  AuditStore,
  RecordAuditInput,
} from './types.js';

interface AuditRow {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  metadata: AuditMetadata | null;
  actorType: AuditActorType;
  actorUserId: string | null;
  actorEmail: string | null;
  requestId: string;
  createdAt: Date | string;
}

const DEFAULT_LIMIT = 50;

const SELECT_EVENT = `
  SELECT
    id,
    action,
    entity_type AS "entityType",
    entity_id AS "entityId",
    summary,
    metadata,
    actor_type AS "actorType",
    actor_user_id AS "actorUserId",
    actor_email AS "actorEmail",
    request_id AS "requestId",
    created_at AS "createdAt"
  FROM audit_events
`;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    metadata: row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {},
    actorType: row.actorType,
    actorUserId: row.actorUserId,
    actorEmail: row.actorEmail,
    requestId: row.requestId ?? '',
    createdAt: iso(row.createdAt),
  };
}

function whereClause(filters?: AuditListFilters): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const clauses: string[] = [];
  if (filters?.action) {
    values.push(filters.action);
    clauses.push(`action = $${values.length}`);
  }
  if (filters?.entityType) {
    values.push(filters.entityType);
    clauses.push(`entity_type = $${values.length}`);
  }
  if (filters?.entityId) {
    values.push(filters.entityId);
    clauses.push(`entity_id = $${values.length}`);
  }
  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

export function createPgAuditStore(pool: pg.Pool): AuditStore {
  return {
    async record(input: RecordAuditInput) {
      const id = randomUUID();
      const result = await pool.query<AuditRow>(
        `
          INSERT INTO audit_events (
            id, action, entity_type, entity_id, summary, metadata,
            actor_type, actor_user_id, actor_email, request_id
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
          RETURNING
            id, action,
            entity_type AS "entityType",
            entity_id AS "entityId",
            summary, metadata,
            actor_type AS "actorType",
            actor_user_id AS "actorUserId",
            actor_email AS "actorEmail",
            request_id AS "requestId",
            created_at AS "createdAt"
        `,
        [
          id,
          input.action,
          input.entityType,
          input.entityId,
          input.summary.trim(),
          JSON.stringify(input.metadata ?? {}),
          input.actorType,
          input.actorUserId ?? null,
          input.actorEmail ?? null,
          input.requestId?.trim() || '',
        ],
      );
      return mapRow(result.rows[0]);
    },
    async list(filters?: AuditListFilters): Promise<AuditListResult> {
      const { sql, values } = whereClause(filters);
      const count = await pool.query<{ total: string | number }>(
        `SELECT COUNT(*)::int AS total FROM audit_events ${sql}`,
        values,
      );
      const limit = filters?.limit ?? DEFAULT_LIMIT;
      const offset = filters?.offset ?? 0;
      const limitIdx = values.length + 1;
      const offsetIdx = values.length + 2;
      const result = await pool.query<AuditRow>(
        `${SELECT_EVENT} ${sql} ORDER BY created_at DESC, id DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...values, limit, offset],
      );
      return {
        events: result.rows.map(mapRow),
        total: Number(count.rows[0]?.total ?? 0),
      };
    },
  };
}
