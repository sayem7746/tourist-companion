import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FAQ_TOPIC_LABELS,
  FAQ_TOPICS,
  FaqService,
  splitFaqLines,
  type FaqDraft,
  type FaqTopic,
} from './faq.service';

@Component({
  selector: 'app-admin-faq-editor',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-faq-editor.html',
  styleUrl: './admin-content.css',
})
export class AdminFaqEditor implements OnInit {
  private readonly faqs = inject(FaqService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly topics = FAQ_TOPICS;
  readonly labels = FAQ_TOPIC_LABELS;

  readonly itemId = signal('');
  readonly pending = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');

  title = '';
  slug = '';
  summary = '';
  body = '';
  tagsText = '';
  topic: FaqTopic | '' = '';
  sortOrder = 0;
  published = false;

  isNew(): boolean {
    return !this.itemId();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.itemId.set(id);
    this.pending.set(true);
    this.faqs.get(id).subscribe({
      next: ({ item }) => {
        this.title = item.title;
        this.slug = item.slug;
        this.summary = item.summary;
        this.body = item.body;
        this.tagsText = item.tags.join(', ');
        this.topic = item.topic ?? '';
        this.sortOrder = item.sortOrder;
        this.published = item.published;
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load this FAQ.');
      },
    });
  }

  submit(): void {
    this.saveError.set('');
    this.pending.set(true);
    const payload = this.draft();
    const request = this.itemId()
      ? this.faqs.update(this.itemId(), payload)
      : this.faqs.create(payload);
    request.subscribe({
      next: ({ item }) => {
        this.pending.set(false);
        void this.router.navigateByUrl(`/admin/faqs/${item.id}`);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.saveError.set(faqSaveError(err));
      },
    });
  }

  private draft(): FaqDraft {
    return {
      title: this.title.trim(),
      slug: this.slug.trim() || undefined,
      summary: this.summary.trim(),
      body: this.body.trim(),
      tags: splitFaqLines(this.tagsText),
      topic: this.topic || null,
      sortOrder: Number(this.sortOrder) || 0,
      published: this.published,
    };
  }
}

export function faqSaveError(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.status === 409) {
    return 'An FAQ with this slug already exists.';
  }
  return 'Could not save this FAQ.';
}
