import { randomBytes, randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationError } from '../errors.js';
import { toReferral } from './map.js';
import type {
  OutboundRedirect,
  Provider,
  Referral,
  ReferralChannel,
  ReferralEvent,
  ReferralEventType,
  ReferralMetadata,
  ReferralPersistence,
  ReferralRow,
  ReferralStatus,
  ReferralTrackResult,
  TrackBookingInput,
  TrackClickInput,
  TrackLeadInput,
} from './types.js';

const MAX_EVENTS = 30;
const CODE_ATTEMPTS = 5;

export function generateReferralCode(): string {
  return `TC-${randomBytes(6).toString('hex').toUpperCase()}`;
}

export function referralRedirectPath(code: string): string {
  return `/r/${encodeURIComponent(code)}`;
}

export function parseReferralMetadata(value: unknown): ReferralMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return { ...(value as ReferralMetadata) };
}

export function providerOutboundBase(provider: Provider): string | null {
  const listing = provider.listing;
  const candidates = [listing?.bookingUrl, listing?.reservationUrl, provider.website];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /^https:\/\//i.test(candidate.trim())) {
      return candidate.trim();
    }
  }
  return null;
}

export function trackedOutboundUrl(
  base: string | null | undefined,
  referral: Pick<Referral, 'referralCode' | 'channel'>,
): string | null {
  if (!base || !/^https:\/\//i.test(base.trim())) return null;
  try {
    const url = new URL(base.trim());
    if (url.protocol !== 'https:') return null;
    url.searchParams.set('ref', referral.referralCode);
    url.searchParams.set('utm_source', 'tourist-companion');
    url.searchParams.set('utm_medium', referral.channel ?? 'referral');
    url.searchParams.set('utm_campaign', 'partner-referral');
    url.searchParams.set('utm_content', referral.referralCode);
    return url.toString();
  } catch {
    return null;
  }
}

export function nextReferralStatus(
  current: ReferralStatus,
  event: ReferralEventType,
): ReferralStatus {
  if (current === 'converted') return 'converted';
  if (event === 'booking') return 'converted';
  if (current === 'expired') return 'expired';
  if (event === 'click' || event === 'lead') return 'clicked';
  return current;
}

export function applyReferralEvent(
  row: ReferralRow,
  event: ReferralEventType,
  options: { now: string; channel?: ReferralChannel; clickKey?: string },
): ReferralRow {
  const metadata = parseReferralMetadata(row.metadata);
  if (options.clickKey && !metadata.clickKey) {
    metadata.clickKey = options.clickKey;
  }
  if (event === 'click') {
    metadata.clickCount = (asCount(metadata.clickCount) ?? 0) + 1;
  } else if (event === 'lead') {
    metadata.leadCount = (asCount(metadata.leadCount) ?? 0) + 1;
  } else if (event === 'booking') {
    metadata.bookingCount = (asCount(metadata.bookingCount) ?? 0) + 1;
  }

  const channel = options.channel ?? row.channel ?? undefined;
  const nextEvent: ReferralEvent = {
    type: event,
    at: options.now,
    ...(channel ? { channel } : {}),
  };
  const events = Array.isArray(metadata.events) ? metadata.events : [];
  metadata.events = [...events, nextEvent].slice(-MAX_EVENTS);

  const status = nextReferralStatus(row.status, event);
  const convertedAt =
    status === 'converted' ? (row.convertedAt ?? options.now) : row.convertedAt;

  return {
    ...row,
    status,
    convertedAt,
    channel: row.channel ?? options.channel ?? null,
    metadata,
  };
}

function asCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function requireActivePartner(provider: Provider | undefined): Provider {
  if (!provider || !provider.isActive) {
    throw new NotFoundError('Partner not found');
  }
  return provider;
}

function trackingResult(row: ReferralRow, created: boolean, provider?: Provider): ReferralTrackResult {
  const referral = toReferral(row);
  const outboundUrl = trackedOutboundUrl(provider ? providerOutboundBase(provider) : null, referral);
  return {
    referral,
    created,
    outboundUrl,
    redirectPath: referralRedirectPath(referral.referralCode),
  };
}

function createReferralRow(input: {
  userId: string;
  providerId: string;
  channel: ReferralChannel;
  tripId?: string | null;
  placeId?: string | null;
  itineraryItemId?: string | null;
  referralCode: string;
  clickKey?: string;
  event: ReferralEventType;
  now: string;
}): ReferralRow {
  const pending: ReferralRow = {
    id: randomUUID(),
    userId: input.userId,
    tripId: input.tripId ?? null,
    providerId: input.providerId,
    placeId: input.placeId ?? null,
    referralCode: input.referralCode,
    status: 'pending',
    channel: input.channel,
    itineraryItemId: input.itineraryItemId ?? null,
    convertedAt: null,
    metadata: input.clickKey ? { clickKey: input.clickKey } : {},
  };
  return applyReferralEvent(pending, input.event, {
    now: input.now,
    channel: input.channel,
    clickKey: input.clickKey,
  });
}

async function insertWithCodeRetry(
  store: ReferralPersistence,
  build: (code: string) => ReferralRow,
): Promise<ReferralRow> {
  let lastError: unknown;
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    try {
      return await store.insertReferral(build(generateReferralCode()));
    } catch (error) {
      lastError = error;
      if (error instanceof ConflictError) {
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new ConflictError('Unable to allocate a referral code');
}

async function resolveExisting(
  store: ReferralPersistence,
  userId: string,
  input: { referralId?: string; referralCode?: string; clickKey?: string },
  options: { required: boolean },
): Promise<ReferralRow | undefined> {
  if (input.referralId) {
    const row = await store.findReferralById(input.referralId);
    if (!row || row.userId !== userId) {
      throw new NotFoundError('Referral not found');
    }
    return row;
  }
  if (input.referralCode) {
    const row = await store.findReferralByCode(input.referralCode);
    if (!row || row.userId !== userId) {
      throw new NotFoundError('Referral not found');
    }
    return row;
  }
  if (input.clickKey) {
    const row = await store.findReferralByClickKey(userId, input.clickKey);
    if (row) return row;
  }
  if (options.required) {
    throw new NotFoundError('Referral not found');
  }
  return undefined;
}

export async function trackClick(
  store: ReferralPersistence,
  input: TrackClickInput,
): Promise<ReferralTrackResult> {
  const provider = requireActivePartner(await store.getProvider(input.providerId));
  const now = nowIso();
  const existing = await resolveExisting(
    store,
    input.userId,
    {
      referralCode: input.referralCode,
      clickKey: input.clickKey,
    },
    { required: Boolean(input.referralCode) },
  );

  if (existing) {
    if (existing.providerId !== input.providerId) {
      throw new NotFoundError('Referral not found');
    }
    const saved = await store.updateReferral(
      applyReferralEvent(existing, 'click', {
        now,
        channel: input.channel,
        clickKey: input.clickKey,
      }),
    );
    return trackingResult(saved, false, provider);
  }

  try {
    const saved = await insertWithCodeRetry(store, (referralCode) =>
      createReferralRow({
        userId: input.userId,
        providerId: input.providerId,
        channel: input.channel,
        tripId: input.tripId,
        placeId: input.placeId,
        itineraryItemId: input.itineraryItemId,
        referralCode,
        clickKey: input.clickKey,
        event: 'click',
        now,
      }),
    );
    return trackingResult(saved, true, provider);
  } catch (error) {
    if (error instanceof ConflictError && input.clickKey) {
      const raced = await store.findReferralByClickKey(input.userId, input.clickKey);
      if (raced) {
        return trackingResult(raced, false, provider);
      }
    }
    throw error;
  }
}

export async function trackLead(
  store: ReferralPersistence,
  input: TrackLeadInput,
): Promise<ReferralTrackResult> {
  const now = nowIso();
  const existing = await resolveExisting(
    store,
    input.userId,
    {
      referralId: input.referralId,
      referralCode: input.referralCode,
      clickKey: input.clickKey,
    },
    { required: Boolean(input.referralId || input.referralCode) },
  );

  if (existing) {
    const provider = await store.getProvider(existing.providerId);
    const saved = await store.updateReferral(
      applyReferralEvent(existing, 'lead', {
        now,
        channel: input.channel ?? existing.channel ?? undefined,
        clickKey: input.clickKey,
      }),
    );
    return trackingResult(saved, false, provider);
  }

  if (!input.providerId || !input.channel) {
    throw new ValidationError('providerId and channel are required to open a lead');
  }
  const provider = requireActivePartner(await store.getProvider(input.providerId));
  try {
    const saved = await insertWithCodeRetry(store, (referralCode) =>
      createReferralRow({
        userId: input.userId,
        providerId: input.providerId!,
        channel: input.channel!,
        tripId: input.tripId,
        placeId: input.placeId,
        itineraryItemId: input.itineraryItemId,
        referralCode,
        clickKey: input.clickKey,
        event: 'lead',
        now,
      }),
    );
    return trackingResult(saved, true, provider);
  } catch (error) {
    if (error instanceof ConflictError && input.clickKey) {
      const raced = await store.findReferralByClickKey(input.userId, input.clickKey);
      if (raced) {
        const saved = await store.updateReferral(
          applyReferralEvent(raced, 'lead', {
            now,
            channel: input.channel,
            clickKey: input.clickKey,
          }),
        );
        return trackingResult(saved, false, provider);
      }
    }
    throw error;
  }
}

export async function trackBooking(
  store: ReferralPersistence,
  input: TrackBookingInput,
): Promise<Referral | undefined> {
  const row = input.referralId
    ? await store.findReferralById(input.referralId)
    : input.referralCode
      ? await store.findReferralByCode(input.referralCode)
      : undefined;
  if (!row) return undefined;
  const saved = await store.updateReferral(
    applyReferralEvent(row, 'booking', { now: nowIso(), channel: row.channel ?? undefined }),
  );
  return toReferral(saved);
}

export async function redirectByCode(
  store: ReferralPersistence,
  code: string,
): Promise<OutboundRedirect | undefined> {
  const row = await store.findReferralByCode(code);
  if (!row) return undefined;
  const provider = await store.getProvider(row.providerId);
  if (!provider) return undefined;
  const preview = toReferral(row);
  const url = trackedOutboundUrl(providerOutboundBase(provider), preview);
  if (!url) return undefined;
  const saved = await store.updateReferral(
    applyReferralEvent(row, 'click', { now: nowIso(), channel: row.channel ?? undefined }),
  );
  const referral = toReferral(saved);
  const tracked = trackedOutboundUrl(providerOutboundBase(provider), referral);
  if (!tracked) return undefined;
  return { referral, url: tracked };
}
