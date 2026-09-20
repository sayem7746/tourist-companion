import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  EMBASSY_FILTER_CHIPS,
  EMBASSY_LEDE,
  EMBASSY_SEARCH_PLACEHOLDER,
  EmbassyService,
  KIND_LABELS,
  officialWebsiteHref,
  type EmbassyDirectory,
  type EmbassyFilterId,
  type ForeignMission,
} from './embassy.service';

@Component({
  selector: 'app-embassies',
  imports: [FormsModule, RouterLink],
  templateUrl: './embassies.html',
  styleUrl: './embassies.css',
})
export class Embassies implements OnInit, OnDestroy {
  private readonly api = inject(EmbassyService);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  readonly chips = EMBASSY_FILTER_CHIPS;
  readonly lede = EMBASSY_LEDE;
  readonly searchPlaceholder = EMBASSY_SEARCH_PLACEHOLDER;
  readonly kindLabels = KIND_LABELS;

  q = '';
  filter: EmbassyFilterId = 'all';

  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly directory = signal<EmbassyDirectory | null>(null);

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.api.directory(this.q, this.filter).subscribe({
      next: (body) => {
        this.directory.set(body);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load the embassy directory. Try again.');
      },
    });
  }

  onSearchInput(value: string): void {
    this.q = value;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.load(), 250);
  }

  clearSearch(): void {
    this.q = '';
    this.load();
  }

  onFilter(id: EmbassyFilterId): void {
    if (this.filter === id) {
      return;
    }
    this.filter = id;
    this.load();
  }

  website(mission: ForeignMission): string {
    return officialWebsiteHref(mission.officialWebsite);
  }
}
