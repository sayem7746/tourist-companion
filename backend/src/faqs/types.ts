import type { ConciergeCategory } from '../knowledge/types.js';

export interface FaqItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  topic: ConciergeCategory | null;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FaqListFilters {
  published?: boolean;
  topic?: ConciergeCategory;
  q?: string;
}

export interface CreateFaqInput {
  slug: string;
  title: string;
  summary?: string;
  body: string;
  tags?: string[];
  topic?: ConciergeCategory | null;
  sortOrder?: number;
  published?: boolean;
}

export interface UpdateFaqInput {
  slug?: string;
  title?: string;
  summary?: string;
  body?: string;
  tags?: string[];
  topic?: ConciergeCategory | null;
  sortOrder?: number;
  published?: boolean;
}
