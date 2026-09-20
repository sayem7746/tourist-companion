import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CONTENT_KIND_CHIPS,
  CONTENT_KIND_LABELS,
  ContentService,
  type ContentItem,
  type ContentKind,
  type ContentPublishedFilter,
} from './content.service';

@Component({
  selector: 'app-admin-content',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-content.html',
  styleUrl: './admin-content.css',
})
export class AdminContent implements OnInit {
  private readonly content = inject(ContentService);

  readonly chips = CONTENT_KIND_CHIPS;
  readonly labels = CONTENT_KIND_LABELS;
  readonly items = signal<ContentItem[]>([]);
  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly actionError = signal('');

  kind: ContentKind | 'all' = 'all';
  published: ContentPublishedFilter = 'all';
  q = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.actionError.set('');
    this.content.list(this.kind, this.published, this.q).subscribe({
      next: ({ items }) => {
        this.items.set(items);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load content.');
      },
    });
  }

  filterKind(kind: ContentKind | 'all'): void {
    this.kind = kind;
    this.load();
  }

  setPublished(published: ContentPublishedFilter): void {
    this.published = published;
    this.load();
  }

  togglePublished(item: ContentItem): void {
    this.actionError.set('');
    const request = item.published
      ? this.content.unpublish(item.id)
      : this.content.publish(item.id);
    request.subscribe({
      next: ({ item: next }) => {
        this.items.set(this.items().map((row) => (row.id === next.id ? next : row)));
      },
      error: () => {
        this.actionError.set('Could not update publish state.');
      },
    });
  }

  remove(item: ContentItem): void {
    if (!confirm(`Delete “${item.title}”?`)) {
      return;
    }
    this.actionError.set('');
    this.content.delete(item.id).subscribe({
      next: () => {
        this.items.set(this.items().filter((row) => row.id !== item.id));
      },
      error: () => {
        this.actionError.set('Could not delete this item.');
      },
    });
  }
}
