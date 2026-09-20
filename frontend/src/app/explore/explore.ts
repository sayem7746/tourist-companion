import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  coverTone,
  DEFAULT_NEARBY_AREA_ID,
  directionsUrl,
  EXPLORE_SEARCH_HEIGHT_PX,
  EXPLORE_SEARCH_PLACEHOLDER,
  formatDistance,
  mapPins,
  NEARBY_AREAS,
  NEARBY_CATEGORY_CHIPS,
  NEARBY_QUICK_FILTER_CHIPS,
  openingStatus,
  SOS_COLOR,
  SOS_NUMBERS,
  type MapPin,
  type NearbyArea,
  type NearbyChipId,
  type NearbyPlace,
  type NearbyQuickFilter,
  type NearbySearchResult,
  ExploreService,
} from './explore.service';

@Component({
  selector: 'app-explore',
  imports: [FormsModule, RouterLink],
  templateUrl: './explore.html',
  styleUrl: './explore.css',
})
export class Explore implements OnInit, OnDestroy {
  private readonly api = inject(ExploreService);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  readonly searchHeightPx = EXPLORE_SEARCH_HEIGHT_PX;
  readonly searchPlaceholder = EXPLORE_SEARCH_PLACEHOLDER;
  readonly areas = NEARBY_AREAS;
  readonly quickFilters = NEARBY_QUICK_FILTER_CHIPS;
  readonly sosColor = SOS_COLOR;
  readonly sosNumbers = SOS_NUMBERS;

  category: NearbyChipId = 'all';
  areaId = DEFAULT_NEARBY_AREA_ID;
  q = '';
  view: 'list' | 'map' = 'list';

  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly sosOpen = signal(false);
  readonly places = signal<NearbyPlace[]>([]);
  readonly chips = signal(NEARBY_CATEGORY_CHIPS);
  readonly counts = signal<Partial<Record<NearbyChipId, number>>>({});
  readonly origin = signal({ latitude: NEARBY_AREAS[0]!.latitude, longitude: NEARBY_AREAS[0]!.longitude });
  readonly radiusMeters = signal(2000);
  readonly areaLabel = signal(NEARBY_AREAS[0]!.label);
  readonly selectedQuick = signal<Set<NearbyQuickFilter>>(new Set());
  readonly bookmarked = signal<Set<string>>(new Set());
  readonly pins = signal<MapPin[]>([]);

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  currentArea(): NearbyArea {
    return this.areas.find((area) => area.id === this.areaId) ?? this.areas[0]!;
  }

  radiusKmLabel(): string {
    const km = (this.radiusMeters() || this.currentArea().radiusMeters) / 1000;
    const pretty = Number.isInteger(km) ? String(km) : km.toFixed(1);
    return `≤${pretty} km`;
  }

  chipCount(id: NearbyChipId): number | undefined {
    return this.counts()[id];
  }

  isQuickOn(id: NearbyQuickFilter): boolean {
    return this.selectedQuick().has(id);
  }

  isBookmarked(id: string): boolean {
    return this.bookmarked().has(id);
  }

  distanceLabel(place: NearbyPlace): string {
    return formatDistance(place);
  }

  openingLabel(place: NearbyPlace): string | null {
    return openingStatus(place);
  }

  mapsHref(place: NearbyPlace): string {
    return directionsUrl(place);
  }

  mediaTone(place: NearbyPlace): string {
    return coverTone(place.nearbyCategory);
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

  selectCategory(id: NearbyChipId): void {
    this.category = id;
    this.load();
  }

  onAreaChange(id: string): void {
    this.areaId = id;
    this.load();
  }

  toggleQuick(id: NearbyQuickFilter): void {
    const next = new Set(this.selectedQuick());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedQuick.set(next);
    this.load();
  }

  toggleBookmark(id: string): void {
    const next = new Set(this.bookmarked());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.bookmarked.set(next);
  }

  setView(view: 'list' | 'map'): void {
    this.view = view;
  }

  openSos(): void {
    this.sosOpen.set(true);
  }

  closeSos(): void {
    this.sosOpen.set(false);
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    const quick = this.selectedQuick();
    this.api
      .nearby({
        category: this.category,
        q: this.q,
        area: this.areaId,
        openNow: quick.has('open_now'),
        halalOnly: quick.has('halal_only'),
        walk15: quick.has('walk_15'),
      })
      .subscribe({
        next: (body) => this.applyResult(body),
        error: () => {
          this.pending.set(false);
          this.places.set([]);
          this.pins.set([]);
          this.loadError.set('Could not load nearby places. Try again.');
        },
      });
  }

  private applyResult(body: NearbySearchResult): void {
    this.pending.set(false);
    this.places.set(body.places);
    this.chips.set(body.chips.length ? body.chips : NEARBY_CATEGORY_CHIPS);
    this.counts.set(body.counts ?? {});
    this.origin.set(body.origin);
    this.radiusMeters.set(body.radiusMeters);
    this.areaLabel.set(body.areaLabel ?? this.currentArea().label);
    this.pins.set(mapPins(body.places, body.origin, body.radiusMeters));
  }
}
