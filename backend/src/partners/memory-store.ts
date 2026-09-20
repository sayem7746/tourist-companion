import { randomUUID } from 'node:crypto';
import { ConflictError, ValidationError } from '../errors.js';
import { applyPartnerPatch, parseCommissionRate, rowFromCreate, toOpsProvider } from './map.js';
import type {
  CreatePartnerInput,
  PartnerListFilters,
  PartnerStore,
  ProviderRow,
  UpdatePartnerInput,
} from './types.js';

function cloneRow(row: ProviderRow): ProviderRow {
  return {
    ...row,
    languages: [...(row.languages ?? [])],
    listingExtras: row.listingExtras ? { ...row.listingExtras } : {},
  };
}

function assertActiveSummary(row: ProviderRow): void {
  if (row.isActive && !row.listingSummary.trim()) {
    throw new ValidationError('Active partners require a listing summary');
  }
  parseCommissionRate(row.commissionRate);
}

export function createMemoryPartnerStore(): PartnerStore {
  const byId = new Map<string, ProviderRow>();
  const slugs = new Map<string, string>();

  const takeSlug = (slug: string, id: string): void => {
    const owner = slugs.get(slug);
    if (owner && owner !== id) {
      throw new ConflictError('A partner with this slug already exists');
    }
    slugs.set(slug, id);
  };

  const matches = (row: ProviderRow, filters?: PartnerListFilters): boolean => {
    if (filters?.category && row.category !== filters.category) return false;
    if (filters?.isActive !== undefined && row.isActive !== filters.isActive) return false;
    return true;
  };

  return {
    async list(filters) {
      return [...byId.values()]
        .filter((row) => matches(row, filters))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => toOpsProvider(cloneRow(row)));
    },
    async get(id) {
      const row = byId.get(id);
      return row ? toOpsProvider(cloneRow(row)) : undefined;
    },
    async create(input: CreatePartnerInput) {
      const row = rowFromCreate(randomUUID(), input);
      assertActiveSummary(row);
      takeSlug(row.slug, row.id);
      byId.set(row.id, cloneRow(row));
      return toOpsProvider(cloneRow(row));
    },
    async update(id, patch: UpdatePartnerInput) {
      const current = byId.get(id);
      if (!current) return undefined;
      const next = applyPartnerPatch(current, patch);
      assertActiveSummary(next);
      if (next.slug !== current.slug) {
        takeSlug(next.slug, id);
        slugs.delete(current.slug);
      }
      byId.set(id, cloneRow(next));
      return toOpsProvider(cloneRow(next));
    },
    async setActive(id, isActive) {
      const current = byId.get(id);
      if (!current) return undefined;
      const next = { ...cloneRow(current), isActive };
      assertActiveSummary(next);
      byId.set(id, next);
      return toOpsProvider(cloneRow(next));
    },
    async delete(id) {
      const current = byId.get(id);
      if (!current) return false;
      byId.delete(id);
      slugs.delete(current.slug);
      return true;
    },
  };
}
