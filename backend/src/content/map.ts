import { ValidationError } from '../errors.js';
import {
  CONTENT_AIRPORTS,
  CONTENT_ARRIVAL_STAGES,
  CONTENT_KINDS,
  CONTENT_PAYMENT_TOPICS,
  CONTENT_SAFETY_TOPICS,
  type ContentAirportCode,
  type ContentItem,
  type ContentKind,
  type CreateContentInput,
  type UpdateContentInput,
} from './types.js';

export function isContentKind(value: string): value is ContentKind {
  return (CONTENT_KINDS as readonly string[]).includes(value);
}

export function isContentAirport(value: string): value is ContentAirportCode {
  return (CONTENT_AIRPORTS as readonly string[]).includes(value);
}

export function slugifyContentTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!slug) {
    throw new Error('Unable to derive a slug from title');
  }
  return slug;
}

export function cloneContent(item: ContentItem): ContentItem {
  return {
    ...item,
    tags: [...item.tags],
    steps: [...item.steps],
  };
}

function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function allowedTopics(kind: ContentKind): readonly string[] | undefined {
  switch (kind) {
    case 'arrival_guide':
      return CONTENT_ARRIVAL_STAGES;
    case 'payment':
      return CONTENT_PAYMENT_TOPICS;
    case 'safety':
      return CONTENT_SAFETY_TOPICS;
    default:
      return undefined;
  }
}

export function assertContentFields(item: Pick<ContentItem, 'kind' | 'topic' | 'airportCode'>): void {
  if (item.airportCode && !isContentAirport(item.airportCode)) {
    throw new ValidationError('airportCode must be KUL or KLIA2');
  }
  const topics = allowedTopics(item.kind);
  if (topics && item.topic && !topics.includes(item.topic)) {
    throw new ValidationError(`topic is not valid for ${item.kind}`);
  }
}

export function rowFromCreate(id: string, input: CreateContentInput, now: string): ContentItem {
  const item: ContentItem = {
    id,
    slug: input.slug,
    kind: input.kind,
    title: input.title.trim(),
    summary: input.summary?.trim() ?? '',
    body: input.body.trim(),
    tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    area: optionalText(input.area) ?? null,
    airportCode: input.airportCode ?? null,
    topic: optionalText(input.topic) ?? null,
    whenToUse: optionalText(input.whenToUse) ?? null,
    icon: optionalText(input.icon) ?? null,
    steps: (input.steps ?? []).map((step) => step.trim()).filter(Boolean),
    sortOrder: input.sortOrder ?? 0,
    published: input.published ?? false,
    createdAt: now,
    updatedAt: now,
  };
  assertContentFields(item);
  return item;
}

export function applyContentPatch(current: ContentItem, patch: UpdateContentInput, now: string): ContentItem {
  const next: ContentItem = {
    ...cloneContent(current),
    slug: patch.slug ?? current.slug,
    kind: patch.kind ?? current.kind,
    title: patch.title?.trim() ?? current.title,
    summary: patch.summary !== undefined ? patch.summary.trim() : current.summary,
    body: patch.body?.trim() ?? current.body,
    tags: patch.tags ? patch.tags.map((tag) => tag.trim()).filter(Boolean) : [...current.tags],
    area: patch.area !== undefined ? (optionalText(patch.area) ?? null) : current.area,
    airportCode: patch.airportCode !== undefined ? patch.airportCode : current.airportCode,
    topic: patch.topic !== undefined ? (optionalText(patch.topic) ?? null) : current.topic,
    whenToUse: patch.whenToUse !== undefined ? (optionalText(patch.whenToUse) ?? null) : current.whenToUse,
    icon: patch.icon !== undefined ? (optionalText(patch.icon) ?? null) : current.icon,
    steps: patch.steps ? patch.steps.map((step) => step.trim()).filter(Boolean) : [...current.steps],
    sortOrder: patch.sortOrder ?? current.sortOrder,
    published: patch.published ?? current.published,
    updatedAt: now,
  };
  assertContentFields(next);
  return next;
}
