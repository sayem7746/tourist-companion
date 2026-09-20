import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  isSafetyGuidePath,
  SAFETY_ACCENT,
  SAFETY_FILTER_CHIPS,
  SAFETY_LEDE,
  SafetyService,
  TOPIC_LABELS,
  type SafetyFilterId,
  type SafetyGuide,
  type SafetyGuideLink,
  type SafetyTip,
} from './safety.service';

@Component({
  selector: 'app-safety',
  imports: [RouterLink],
  templateUrl: './safety.html',
  styleUrl: './safety.css',
})
export class Safety implements OnInit {
  private readonly api = inject(SafetyService);

  readonly chips = SAFETY_FILTER_CHIPS;
  readonly lede = SAFETY_LEDE;
  readonly topicLabels = TOPIC_LABELS;
  readonly fallbackAccent = SAFETY_ACCENT;

  filter: SafetyFilterId = 'all';

  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly guide = signal<SafetyGuide | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.api.guide(this.filter).subscribe({
      next: (body) => {
        this.guide.set(body);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load safety tips. Try again.');
      },
    });
  }

  onFilter(id: SafetyFilterId): void {
    if (this.filter === id) {
      return;
    }
    this.filter = id;
    this.load();
  }

  accent(): string {
    return this.guide()?.accent || this.fallbackAccent;
  }

  visibleLinks(tip: SafetyTip): SafetyGuideLink[] {
    return tip.links.filter((link) => isSafetyGuidePath(link.path));
  }
}
