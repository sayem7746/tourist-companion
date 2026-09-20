import { randomUUID } from 'node:crypto';
import { ConflictError } from '../errors.js';
import { applyContentPatch, cloneContent, rowFromCreate } from './map.js';
import type {
  ContentItem,
  ContentListFilters,
  ContentStore,
  CreateContentInput,
  UpdateContentInput,
} from './types.js';

function matchesQuery(item: ContentItem, needle: string): boolean {
  const blob = [
    item.title,
    item.summary,
    item.body,
    item.slug,
    item.tags.join(' '),
    item.area ?? '',
    item.topic ?? '',
  ].join(' ');
  return blob.toLowerCase().includes(needle.toLowerCase());
}

function sortItems(a: ContentItem, b: ContentItem): number {
  return a.kind.localeCompare(b.kind) || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
}

export function createMemoryContentStore(seed: ContentItem[] = []): ContentStore {
  const byId = new Map<string, ContentItem>();
  const slugs = new Map<string, string>();

  const takeSlug = (slug: string, id: string): void => {
    const owner = slugs.get(slug);
    if (owner && owner !== id) {
      throw new ConflictError('A content item with this slug already exists');
    }
    slugs.set(slug, id);
  };

  for (const item of seed) {
    const copy = cloneContent(item);
    byId.set(copy.id, copy);
    takeSlug(copy.slug, copy.id);
  }

  return {
    async list(filters?: ContentListFilters) {
      const needle = filters?.q?.trim();
      return [...byId.values()]
        .filter((item) => (filters?.kind ? item.kind === filters.kind : true))
        .filter((item) => (filters?.published === undefined ? true : item.published === filters.published))
        .filter((item) => (needle ? matchesQuery(item, needle) : true))
        .sort(sortItems)
        .map(cloneContent);
    },
    async get(id) {
      const item = byId.get(id);
      return item ? cloneContent(item) : undefined;
    },
    async create(input: CreateContentInput) {
      const id = randomUUID();
      takeSlug(input.slug, id);
      const item = rowFromCreate(id, input, new Date().toISOString());
      byId.set(id, item);
      return cloneContent(item);
    },
    async update(id, patch: UpdateContentInput) {
      const current = byId.get(id);
      if (!current) return undefined;
      const next = applyContentPatch(current, patch, new Date().toISOString());
      if (next.slug !== current.slug) {
        slugs.delete(current.slug);
        takeSlug(next.slug, id);
      }
      byId.set(id, next);
      return cloneContent(next);
    },
    async setPublished(id, published) {
      const current = byId.get(id);
      if (!current) return undefined;
      const next = { ...cloneContent(current), published, updatedAt: new Date().toISOString() };
      byId.set(id, next);
      return cloneContent(next);
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
