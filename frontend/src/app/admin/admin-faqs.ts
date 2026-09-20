import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  FAQ_TOPIC_CHIPS,
  FAQ_TOPIC_LABELS,
  FaqService,
  type FaqItem,
  type FaqPublishedFilter,
  type FaqTopic,
} from './faq.service';

@Component({
  selector: 'app-admin-faqs',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-faqs.html',
  styleUrl: './admin-content.css',
})
export class AdminFaqs implements OnInit {
  private readonly faqs = inject(FaqService);

  readonly chips = FAQ_TOPIC_CHIPS;
  readonly labels = FAQ_TOPIC_LABELS;
  readonly items = signal<FaqItem[]>([]);
  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly actionError = signal('');

  topic: FaqTopic | 'all' = 'all';
  published: FaqPublishedFilter = 'all';
  q = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.actionError.set('');
    this.faqs.list(this.topic, this.published, this.q).subscribe({
      next: ({ items }) => {
        this.items.set(items);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load FAQs.');
      },
    });
  }

  filterTopic(topic: FaqTopic | 'all'): void {
    this.topic = topic;
    this.load();
  }

  setPublished(published: FaqPublishedFilter): void {
    this.published = published;
    this.load();
  }

  topicLabel(item: FaqItem): string {
    return item.topic ? this.labels[item.topic] : 'Uncategorized';
  }

  togglePublished(item: FaqItem): void {
    this.actionError.set('');
    const request = item.published ? this.faqs.unpublish(item.id) : this.faqs.publish(item.id);
    request.subscribe({
      next: ({ item: next }) => {
        this.items.set(this.items().map((row) => (row.id === next.id ? next : row)));
      },
      error: () => {
        this.actionError.set('Could not update publish state.');
      },
    });
  }

  remove(item: FaqItem): void {
    if (!confirm(`Delete “${item.title}”?`)) {
      return;
    }
    this.actionError.set('');
    this.faqs.delete(item.id).subscribe({
      next: () => {
        this.items.set(this.items().filter((row) => row.id !== item.id));
      },
      error: () => {
        this.actionError.set('Could not delete this FAQ.');
      },
    });
  }
}
