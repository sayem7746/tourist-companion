import { parseReferralMetadata } from './tracking.js';
import type {
  Provider,
  ReferralAnalytics,
  ReferralAnalyticsCounts,
  ReferralAnalyticsFilters,
  ReferralAnalyticsTotals,
  ReferralChannelPerformance,
  ReferralRow,
} from './types.js';

export interface ReferralAnalyticsJoin {
  referral: ReferralRow;
  partner: Pick<Provider, 'id' | 'name' | 'slug' | 'category' | 'isActive'>;
}

function asCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
}

function emptyCounts(): ReferralAnalyticsCounts {
  return { referrals: 0, clicks: 0, leads: 0, conversions: 0 };
}

export function conversionRate(conversions: number, clicks: number): number {
  if (clicks <= 0) return 0;
  return Math.round((conversions / clicks) * 10000) / 10000;
}

export function referralEventCounts(row: Pick<ReferralRow, 'status' | 'metadata'>): ReferralAnalyticsCounts {
  const metadata = parseReferralMetadata(row.metadata);
  const clickCount = asCount(metadata.clickCount);
  const leadCount = asCount(metadata.leadCount);
  const bookingCount = asCount(metadata.bookingCount);
  const hasEventCounts = clickCount !== undefined || leadCount !== undefined || bookingCount !== undefined;
  if (hasEventCounts) {
    return {
      referrals: 1,
      clicks: clickCount ?? 0,
      leads: leadCount ?? 0,
      conversions: bookingCount ?? (row.status === 'converted' ? 1 : 0),
    };
  }
  return {
    referrals: 1,
    clicks: row.status === 'clicked' || row.status === 'converted' ? 1 : 0,
    leads: 0,
    conversions: row.status === 'converted' ? 1 : 0,
  };
}

function addCounts(target: ReferralAnalyticsCounts, add: ReferralAnalyticsCounts): void {
  target.referrals += add.referrals;
  target.clicks += add.clicks;
  target.leads += add.leads;
  target.conversions += add.conversions;
}

function emptyTotals(): ReferralAnalyticsTotals {
  return {
    ...emptyCounts(),
    pending: 0,
    clicked: 0,
    converted: 0,
    expired: 0,
    conversionRate: 0,
  };
}

export function summarizeReferralAnalytics(rows: ReferralAnalyticsJoin[]): ReferralAnalytics {
  const totals = emptyTotals();
  const partners = new Map<string, ReferralAnalytics['partners'][number]>();
  const channels = new Map<string, ReferralChannelPerformance>();

  for (const { referral, partner } of rows) {
    const counts = referralEventCounts(referral);
    addCounts(totals, counts);
    totals[referral.status] += 1;

    let partnerRow = partners.get(partner.id);
    if (!partnerRow) {
      partnerRow = {
        providerId: partner.id,
        name: partner.name,
        slug: partner.slug,
        category: partner.category,
        isActive: partner.isActive,
        ...emptyCounts(),
        conversionRate: 0,
      };
      partners.set(partner.id, partnerRow);
    }
    addCounts(partnerRow, counts);

    const channelKey = referral.channel ?? '';
    let channelRow = channels.get(channelKey);
    if (!channelRow) {
      channelRow = { channel: referral.channel, ...emptyCounts() };
      channels.set(channelKey, channelRow);
    }
    addCounts(channelRow, counts);
  }

  totals.conversionRate = conversionRate(totals.conversions, totals.clicks);

  const partnerRows = [...partners.values()].map((row) => ({
    ...row,
    conversionRate: conversionRate(row.conversions, row.clicks),
  }));
  partnerRows.sort((a, b) => {
    if (b.conversions !== a.conversions) return b.conversions - a.conversions;
    if (b.clicks !== a.clicks) return b.clicks - a.clicks;
    return a.name.localeCompare(b.name);
  });

  const channelRows = [...channels.values()];
  channelRows.sort((a, b) => {
    if (b.clicks !== a.clicks) return b.clicks - a.clicks;
    return (a.channel ?? '').localeCompare(b.channel ?? '');
  });

  return { totals, partners: partnerRows, channels: channelRows };
}

export function collectReferralAnalytics(
  referrals: ReferralRow[],
  partners: Provider[],
  filters?: ReferralAnalyticsFilters,
): ReferralAnalytics {
  const byId = new Map(partners.map((partner) => [partner.id, partner]));
  const joined: ReferralAnalyticsJoin[] = [];
  for (const referral of referrals) {
    const partner = byId.get(referral.providerId);
    if (!partner) continue;
    if (filters?.providerId && referral.providerId !== filters.providerId) continue;
    if (filters?.category && partner.category !== filters.category) continue;
    if (filters?.channel && referral.channel !== filters.channel) continue;
    joined.push({ referral, partner });
  }

  const analytics = summarizeReferralAnalytics(joined);
  if (filters?.providerId) {
    const partner = byId.get(filters.providerId);
    const categoryOk = !filters.category || partner?.category === filters.category;
    if (partner && categoryOk && !analytics.partners.some((row) => row.providerId === partner.id)) {
      analytics.partners.push({
        providerId: partner.id,
        name: partner.name,
        slug: partner.slug,
        category: partner.category,
        isActive: partner.isActive,
        ...emptyCounts(),
        conversionRate: 0,
      });
    }
  }
  return analytics;
}
