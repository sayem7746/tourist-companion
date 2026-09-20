import { randomUUID } from 'node:crypto';
import { ConflictError, ValidationError } from '../errors.js';
import { collectReferralAnalytics } from './analytics.js';
import { applyPartnerPatch, parseCommissionRate, rowFromCreate, toOpsProvider, toReferral } from './map.js';
import {
  redirectByCode,
  trackBooking,
  trackClick,
  trackLead,
} from './tracking.js';
import type {
  CreatePartnerInput,
  PartnerListFilters,
  PartnerStore,
  ProviderRow,
  ReferralPersistence,
  ReferralRow,
  UpdatePartnerInput,
} from './types.js';

function cloneRow(row: ProviderRow): ProviderRow {
  return {
    ...row,
    languages: [...(row.languages ?? [])],
    listingExtras: row.listingExtras ? { ...row.listingExtras } : {},
  };
}

function cloneReferral(row: ReferralRow): ReferralRow {
  return {
    ...row,
    metadata: { ...row.metadata, events: row.metadata.events ? [...row.metadata.events] : undefined },
  };
}

function assertActiveSummary(row: ProviderRow): void {
  if (row.isActive && !row.listingSummary.trim()) {
    throw new ValidationError('Active partners require a listing summary');
  }
  parseCommissionRate(row.commissionRate);
}

function clickKeyIndex(userId: string, clickKey: string): string {
  return `${userId}:${clickKey}`;
}

export function createMemoryPartnerStore(): PartnerStore {
  const byId = new Map<string, ProviderRow>();
  const slugs = new Map<string, string>();
  const referralsById = new Map<string, ReferralRow>();
  const referralCodes = new Map<string, string>();
  const referralClickKeys = new Map<string, string>();

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

  const indexClickKey = (row: ReferralRow): void => {
    const key = row.metadata.clickKey;
    if (typeof key === 'string' && key.trim()) {
      referralClickKeys.set(clickKeyIndex(row.userId, key.trim()), row.id);
    }
  };

  const persistence: ReferralPersistence = {
    async getProvider(id) {
      const row = byId.get(id);
      return row ? toOpsProvider(cloneRow(row)) : undefined;
    },
    async findReferralById(id) {
      const row = referralsById.get(id);
      return row ? cloneReferral(row) : undefined;
    },
    async findReferralByCode(code) {
      const id = referralCodes.get(code);
      if (!id) return undefined;
      const row = referralsById.get(id);
      return row ? cloneReferral(row) : undefined;
    },
    async findReferralByClickKey(userId, clickKey) {
      const id = referralClickKeys.get(clickKeyIndex(userId, clickKey));
      if (!id) return undefined;
      const row = referralsById.get(id);
      return row ? cloneReferral(row) : undefined;
    },
    async insertReferral(row) {
      if (referralCodes.has(row.referralCode)) {
        throw new ConflictError('Referral code already exists');
      }
      const clickKey = row.metadata.clickKey;
      if (typeof clickKey === 'string' && clickKey.trim()) {
        const index = clickKeyIndex(row.userId, clickKey.trim());
        if (referralClickKeys.has(index)) {
          throw new ConflictError('Referral code already exists');
        }
      }
      const stored = cloneReferral(row);
      referralsById.set(stored.id, stored);
      referralCodes.set(stored.referralCode, stored.id);
      indexClickKey(stored);
      return cloneReferral(stored);
    },
    async updateReferral(row) {
      if (!referralsById.has(row.id)) {
        throw new ValidationError('Referral not found');
      }
      const stored = cloneReferral(row);
      referralsById.set(stored.id, stored);
      referralCodes.set(stored.referralCode, stored.id);
      indexClickKey(stored);
      return cloneReferral(stored);
    },
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
      for (const referral of referralsById.values()) {
        if (referral.providerId === id) {
          throw new ConflictError('Partner has referrals; pause the listing instead of deleting');
        }
      }
      byId.delete(id);
      slugs.delete(current.slug);
      return true;
    },
    trackClick(input) {
      return trackClick(persistence, input);
    },
    trackLead(input) {
      return trackLead(persistence, input);
    },
    trackBooking(input) {
      return trackBooking(persistence, input);
    },
    async listReferrals(userId) {
      return [...referralsById.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.referralCode.localeCompare(a.referralCode))
        .map((row) => toReferral(cloneReferral(row)));
    },
    redirectByCode(code) {
      return redirectByCode(persistence, code);
    },
    async getReferralAnalytics(filters) {
      return collectReferralAnalytics(
        [...referralsById.values()].map((row) => cloneReferral(row)),
        [...byId.values()].map((row) => toOpsProvider(cloneRow(row))),
        filters,
      );
    },
  };
}
