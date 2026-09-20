import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CONTENT_AIRPORTS,
  CONTENT_KIND_LABELS,
  CONTENT_KINDS,
  ContentService,
  showsAirport,
  showsArea,
  showsSteps,
  splitLines,
  topicOptionsForKind,
  type ContentAirportCode,
  type ContentDraft,
  type ContentKind,
} from './content.service';

@Component({
  selector: 'app-admin-content-editor',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-content-editor.html',
  styleUrl: './admin-content.css',
})
export class AdminContentEditor implements OnInit {
  private readonly content = inject(ContentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly kinds = CONTENT_KINDS;
  readonly labels = CONTENT_KIND_LABELS;
  readonly airports = CONTENT_AIRPORTS;

  readonly itemId = signal('');
  readonly pending = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');

  title = '';
  slug = '';
  kind: ContentKind = 'faq';
  summary = '';
  body = '';
  tagsText = '';
  area = '';
  airportCode: ContentAirportCode | '' = '';
  topic = '';
  whenToUse = '';
  icon = '';
  stepsText = '';
  sortOrder = 0;
  published = false;

  isNew(): boolean {
    return !this.itemId();
  }

  topicOptions(): Array<{ id: string; label: string }> {
    return topicOptionsForKind(this.kind);
  }

  showAirport(): boolean {
    return showsAirport(this.kind);
  }

  showSteps(): boolean {
    return showsSteps(this.kind);
  }

  showArea(): boolean {
    return showsArea(this.kind);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.itemId.set(id);
    this.pending.set(true);
    this.content.get(id).subscribe({
      next: ({ item }) => {
        this.title = item.title;
        this.slug = item.slug;
        this.kind = item.kind;
        this.summary = item.summary;
        this.body = item.body;
        this.tagsText = item.tags.join(', ');
        this.area = item.area ?? '';
        this.airportCode = item.airportCode ?? '';
        this.topic = item.topic ?? '';
        this.whenToUse = item.whenToUse ?? '';
        this.icon = item.icon ?? '';
        this.stepsText = item.steps.join('\n');
        this.sortOrder = item.sortOrder;
        this.published = item.published;
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load this article.');
      },
    });
  }

  onKindChange(kind: ContentKind): void {
    this.kind = kind;
    if (topicOptionsForKind(kind).length === 0) {
      this.topic = '';
    }
    if (!showsAirport(kind)) {
      this.airportCode = '';
    }
  }

  submit(): void {
    this.saveError.set('');
    this.pending.set(true);
    const payload = this.draft();
    const request = this.itemId()
      ? this.content.update(this.itemId(), payload)
      : this.content.create(payload);
    request.subscribe({
      next: ({ item }) => {
        this.pending.set(false);
        void this.router.navigateByUrl(`/admin/content/${item.id}`);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.saveError.set(contentSaveError(err));
      },
    });
  }

  private draft(): ContentDraft {
    const tags = splitLines(this.tagsText);
    const steps = splitLines(this.stepsText);
    return {
      title: this.title.trim(),
      slug: this.slug.trim() || undefined,
      kind: this.kind,
      summary: this.summary.trim(),
      body: this.body.trim(),
      tags,
      area: this.showArea() ? this.area.trim() || null : null,
      airportCode: this.showAirport() ? this.airportCode || null : null,
      topic: this.topic.trim() || null,
      whenToUse: this.whenToUse.trim() || null,
      icon: this.icon.trim() || null,
      steps,
      sortOrder: Number(this.sortOrder) || 0,
      published: this.published,
    };
  }
}

export function contentSaveError(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.status === 409) {
    return 'A content item with this slug already exists.';
  }
  return 'Could not save this article.';
}
