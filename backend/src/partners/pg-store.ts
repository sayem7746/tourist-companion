import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ConflictError, ValidationError } from '../errors.js';
import { applyPartnerPatch, parseCommissionRate, rowFromCreate, toOpsProvider } from './map.js';
import type {
  CreatePartnerInput,
  PartnerListFilters,
  PartnerStore,
  ProviderRow,
  UpdatePartnerInput,
} from './types.js';

const SELECT_PROVIDER = `
  SELECT
    id,
    name,
    slug,
    category,
    is_active AS "isActive",
    website,
    contact_email AS "contactEmail",
    commission_rate AS "commissionRate",
    commission_basis AS "commissionBasis",
    commission_currency AS "commissionCurrency",
    listing_summary AS "listingSummary",
    listing_city AS "listingCity",
    listing_area AS "listingArea",
    booking_url AS "bookingUrl",
    disclosure,
    sponsored,
    license_name AS "licenseName",
    license_id AS "licenseId",
    typical_myr AS "typicalMyr",
    languages,
    listing_extras AS "listingExtras"
  FROM providers
`;

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

function isFkViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23503'
  );
}

function mapDbError(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new ConflictError('A partner with this slug already exists');
  }
  if (isCheckViolation(error)) {
    throw new ValidationError('Partner listing failed a database constraint');
  }
  throw error;
}

async function insertRow(pool: pg.Pool, row: ProviderRow): Promise<ProviderRow> {
  parseCommissionRate(row.commissionRate);
  try {
    const result = await pool.query<ProviderRow>(
      `INSERT INTO providers (
         id, name, slug, category, is_active, website, contact_email,
         commission_rate, commission_basis, commission_currency,
         listing_summary, listing_city, listing_area, booking_url,
         disclosure, sponsored, license_name, license_id, typical_myr,
         languages, listing_extras
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10,
         $11, $12, $13, $14,
         $15, $16, $17, $18, $19,
         $20, $21::jsonb
       )
       RETURNING
         id, name, slug, category,
         is_active AS "isActive", website, contact_email AS "contactEmail",
         commission_rate AS "commissionRate", commission_basis AS "commissionBasis",
         commission_currency AS "commissionCurrency",
         listing_summary AS "listingSummary", listing_city AS "listingCity",
         listing_area AS "listingArea", booking_url AS "bookingUrl",
         disclosure, sponsored, license_name AS "licenseName",
         license_id AS "licenseId", typical_myr AS "typicalMyr",
         languages, listing_extras AS "listingExtras"`,
      [
        row.id,
        row.name,
        row.slug,
        row.category,
        row.isActive,
        row.website,
        row.contactEmail,
        row.commissionRate,
        row.commissionBasis,
        row.commissionCurrency,
        row.listingSummary,
        row.listingCity,
        row.listingArea,
        row.bookingUrl,
        row.disclosure,
        row.sponsored,
        row.licenseName,
        row.licenseId,
        row.typicalMyr,
        row.languages ?? [],
        JSON.stringify(row.listingExtras ?? {}),
      ],
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function persistRow(pool: pg.Pool, row: ProviderRow): Promise<ProviderRow> {
  parseCommissionRate(row.commissionRate);
  try {
    const result = await pool.query<ProviderRow>(
      `UPDATE providers SET
         name = $2,
         slug = $3,
         category = $4,
         is_active = $5,
         website = $6,
         contact_email = $7,
         commission_rate = $8,
         commission_basis = $9,
         listing_summary = $10,
         listing_city = $11,
         listing_area = $12,
         booking_url = $13,
         disclosure = $14,
         sponsored = $15,
         license_name = $16,
         license_id = $17,
         typical_myr = $18,
         languages = $19,
         listing_extras = $20::jsonb,
         updated_at = NOW()
       WHERE id = $1
       RETURNING
         id, name, slug, category,
         is_active AS "isActive", website, contact_email AS "contactEmail",
         commission_rate AS "commissionRate", commission_basis AS "commissionBasis",
         commission_currency AS "commissionCurrency",
         listing_summary AS "listingSummary", listing_city AS "listingCity",
         listing_area AS "listingArea", booking_url AS "bookingUrl",
         disclosure, sponsored, license_name AS "licenseName",
         license_id AS "licenseId", typical_myr AS "typicalMyr",
         languages, listing_extras AS "listingExtras"`,
      [
        row.id,
        row.name,
        row.slug,
        row.category,
        row.isActive,
        row.website,
        row.contactEmail,
        row.commissionRate,
        row.commissionBasis,
        row.listingSummary,
        row.listingCity,
        row.listingArea,
        row.bookingUrl,
        row.disclosure,
        row.sponsored,
        row.licenseName,
        row.licenseId,
        row.typicalMyr,
        row.languages ?? [],
        JSON.stringify(row.listingExtras ?? {}),
      ],
    );
    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

export function createPgPartnerStore(pool: pg.Pool): PartnerStore {
  return {
    async list(filters?: PartnerListFilters) {
      const clauses: string[] = [];
      const values: unknown[] = [];
      if (filters?.category) {
        values.push(filters.category);
        clauses.push(`category = $${values.length}`);
      }
      if (filters?.isActive !== undefined) {
        values.push(filters.isActive);
        clauses.push(`is_active = $${values.length}`);
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      const result = await pool.query<ProviderRow>(
        `${SELECT_PROVIDER} ${where} ORDER BY name ASC`,
        values,
      );
      return result.rows.map((row) => toOpsProvider(row));
    },
    async get(id) {
      const result = await pool.query<ProviderRow>(`${SELECT_PROVIDER} WHERE id = $1`, [id]);
      const row = result.rows[0];
      return row ? toOpsProvider(row) : undefined;
    },
    async create(input: CreatePartnerInput) {
      const row = rowFromCreate(randomUUID(), input);
      return toOpsProvider(await insertRow(pool, row));
    },
    async update(id, patch: UpdatePartnerInput) {
      const current = await pool.query<ProviderRow>(`${SELECT_PROVIDER} WHERE id = $1`, [id]);
      if (!current.rows[0]) return undefined;
      const next = applyPartnerPatch(current.rows[0], patch);
      return toOpsProvider(await persistRow(pool, next));
    },
    async setActive(id, isActive) {
      const current = await pool.query<ProviderRow>(`${SELECT_PROVIDER} WHERE id = $1`, [id]);
      if (!current.rows[0]) return undefined;
      const next = { ...current.rows[0], isActive };
      return toOpsProvider(await persistRow(pool, next));
    },
    async delete(id) {
      try {
        const result = await pool.query('DELETE FROM providers WHERE id = $1', [id]);
        return (result.rowCount ?? 0) > 0;
      } catch (error) {
        if (isFkViolation(error)) {
          throw new ConflictError('Partner has referrals; pause the listing instead of deleting');
        }
        throw error;
      }
    },
  };
}
