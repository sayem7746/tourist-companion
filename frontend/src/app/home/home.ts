import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { PartnerListings } from '../partners/partner-listings';
import { NEARBY_PARTNER_CATEGORIES, TRIP_PARTNER_CATEGORIES } from '../partners/partner.service';
import {
  ARRIVAL_STAGES,
  type ArrivalChecklistItem,
  type ArrivalStage,
  ArrivalService,
  STAGE_LABELS,
} from '../arrival/arrival.service';
import { loadDoneIds, progressPercent } from '../arrival/arrival-progress';
import { ExploreService, formatDistance, type NearbyPlace } from '../explore/explore.service';
import {
  buildTimeline,
  formatPlanDate,
  formatTime12h,
  highlightCount,
  inclusiveDayCount,
  itineraryIsEmpty,
  localTodayIso,
  selectFeaturedTrip,
  selectPlanDayNumber,
  TripService,
  type Itinerary,
  type ItineraryItem,
  type TimelineRow,
  type Trip,
} from '../trips/trip.service';

export function selamatGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) {
    return 'Selamat Pagi';
  }
  if (hour < 19) {
    return 'Selamat Petang';
  }
  return 'Selamat Malam';
}

export function firstName(displayName: string | null | undefined): string {
  const part = displayName?.trim().split(/\s+/)[0];
  return part || 'traveler';
}

export function tripDayNumber(startDate: string, today: string, dayCount: number): number {
  const elapsed = inclusiveDayCount(startDate, today);
  return Math.min(Math.max(elapsed, 1), Math.max(dayCount, 1));
}

export function formatTripRange(startDate: string, endDate: string): string {
  const fmt = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    if (!year || !month || !day) {
      return iso;
    }
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
  };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

export const STAGE_NEXT: Record<ArrivalStage, { href: string; icon: string; label: string }> = {
  immigration: { href: '/arrival', icon: 'fingerprint', label: 'Immigration & Passport Control' },
  baggage: { href: '/arrival', icon: 'luggage', label: 'Baggage Reclaim' },
  customs: { href: '/arrival', icon: 'local_shipping', label: 'Customs Clearance' },
  sim: { href: '/arrival/sim', icon: 'sim_card', label: 'Get Connected: eSIM / 5G SIM' },
  money: { href: '/arrival/money', icon: 'payments', label: 'Ringgit, ATMs & cards' },
  transport: { href: '/arrival/transport', icon: 'directions_subway', label: 'Ground transit to the city' },
  first_steps: { href: '/arrival', icon: 'hotel', label: 'First steps after you land' },
};

export function nextArrivalStage(items: ArrivalChecklistItem[], done: Set<string>): ArrivalStage | null {
  const remaining = items.find((item) => !done.has(item.id));
  return remaining?.stage ?? null;
}

export function planIcon(item: ItineraryItem): string {
  if (item.kind === 'meal') {
    return 'restaurant';
  }
  if (item.kind === 'travel') {
    return 'commute';
  }
  if (item.kind === 'note') {
    return 'sticky_note_2';
  }
  return 'navigation';
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, PartnerListings],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly tripsApi = inject(TripService);
  private readonly arrivalApi = inject(ArrivalService);
  private readonly exploreApi = inject(ExploreService);

  readonly greeting = selamatGreeting();
  readonly stageLabels = STAGE_LABELS;
  readonly tripPartnerCategories = TRIP_PARTNER_CATEGORIES;
  readonly nearbyPartnerCategories = NEARBY_PARTNER_CATEGORIES;
  readonly displayName = signal('');
  readonly trip = signal<Trip | null>(null);
  readonly dayCount = signal(0);
  readonly dayNumber = signal(1);
  readonly itinerary = signal<Itinerary | null>(null);
  readonly nearby = signal<NearbyPlace[]>([]);
  readonly areaLabel = signal('KLCC Precinct');
  readonly arrivalItems = signal<ArrivalChecklistItem[]>([]);
  readonly arrivalDone = signal<Set<string>>(new Set());

  readonly greetLine = computed(() => `${this.greeting}, ${firstName(this.displayName())}`);
  readonly tripRange = computed(() => {
    const trip = this.trip();
    return trip ? formatTripRange(trip.startDate, trip.endDate) : '';
  });
  readonly arrivalDoneCount = computed(
    () => this.arrivalItems().filter((item) => this.arrivalDone().has(item.id)).length,
  );
  readonly arrivalPercent = computed(() => progressPercent(this.arrivalDoneCount(), this.arrivalItems().length));
  readonly nextStage = computed(() => nextArrivalStage(this.arrivalItems(), this.arrivalDone()));
  readonly nextMeta = computed(() => {
    const stage = this.nextStage();
    return stage ? STAGE_NEXT[stage] : { href: '/arrival', icon: 'checklist', label: 'Open arrival checklist' };
  });
  readonly nextStepIndex = computed(() => {
    const stage = this.nextStage();
    if (!stage) {
      return Math.max(1, this.arrivalItems().length);
    }
    return ARRIVAL_STAGES.indexOf(stage) + 1;
  });
  readonly selectedDay = computed(() => {
    const plan = this.itinerary();
    if (!plan) {
      return null;
    }
    const number = selectPlanDayNumber(plan, localTodayIso());
    return plan.days.find((day) => day.dayNumber === number) ?? plan.days[0] ?? null;
  });
  readonly highlights = computed(() => highlightCount(this.selectedDay()));
  readonly timeline = computed<TimelineRow[]>(() => buildTimeline(this.selectedDay()?.items ?? []));
  readonly planEmpty = computed(() => itineraryIsEmpty(this.itinerary()));
  readonly weather = computed(() => this.selectedDay()?.weather ?? null);

  ngOnInit(): void {
    this.loadArrival();
    this.loadNearby();
    this.loadSession();
  }

  formatTime(hhmm: string): string {
    return formatTime12h(hhmm);
  }

  formatDate(isoDate: string): string {
    return formatPlanDate(isoDate);
  }

  itemTitle(item: ItineraryItem): string {
    return item.title?.trim() || 'Planned stop';
  }

  itemIcon(item: ItineraryItem): string {
    return planIcon(item);
  }

  distance(place: NearbyPlace): string {
    return formatDistance(place);
  }

  private loadArrival(): void {
    this.arrivalApi.list().subscribe({
      next: (body) => {
        this.arrivalItems.set(body.items);
        this.arrivalDone.set(loadDoneIds(body.airportCode));
      },
      error: () => {
        this.arrivalItems.set([]);
      },
    });
  }

  private loadNearby(): void {
    this.exploreApi.nearby({ area: 'klcc' }).subscribe({
      next: (body) => {
        this.nearby.set(body.places.slice(0, 2));
        this.areaLabel.set(body.areaLabel || 'KLCC Precinct');
      },
      error: () => {
        this.nearby.set([]);
      },
    });
  }

  private loadSession(): void {
    this.auth.me().subscribe({
      next: ({ user }) => {
        this.displayName.set(user.displayName);
        this.loadTrip();
      },
      error: () => {
        this.displayName.set('');
      },
    });
  }

  private loadTrip(): void {
    this.tripsApi.list().subscribe({
      next: ({ trips }) => {
        const today = localTodayIso();
        const trip = selectFeaturedTrip(trips, today);
        this.trip.set(trip);
        if (!trip) {
          return;
        }
        const days = inclusiveDayCount(trip.startDate, trip.endDate);
        this.dayCount.set(days);
        this.dayNumber.set(tripDayNumber(trip.startDate, today, days));
        this.tripsApi.getItinerary(trip.id).subscribe({
          next: ({ itinerary }) => this.itinerary.set(itinerary),
          error: () => this.itinerary.set(null),
        });
      },
      error: () => {
        this.trip.set(null);
      },
    });
  }
}
