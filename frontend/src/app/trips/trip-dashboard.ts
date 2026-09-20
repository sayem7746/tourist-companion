import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  Trip,
  TripService,
  type Itinerary,
  type ItineraryDay,
  type ItineraryItem,
  type SavedTripPlace,
} from './trip.service';

export {
  buildTimeline,
  formatPlanDate,
  formatTime12h,
  highlightCount,
  inclusiveDayCount,
  itineraryIsEmpty,
  localTodayIso,
  selectFeaturedTrip,
  selectPlanDayNumber,
} from './trip.service';

@Component({
  selector: 'app-trip-dashboard',
  imports: [RouterLink],
  templateUrl: './trip-dashboard.html',
  styleUrl: './trip-dashboard.css',
})
export class TripDashboard implements OnInit {
  private readonly tripsApi = inject(TripService);

  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly featured = signal<Trip | null>(null);
  readonly featuredKind = signal<'current' | 'upcoming' | 'none'>('none');
  readonly dayCount = signal(0);
  readonly savedPlaces = signal<SavedTripPlace[]>([]);
  readonly savedError = signal('');
  readonly itinerary = signal<Itinerary | null>(null);
  readonly itineraryPending = signal(false);
  readonly itineraryError = signal('');
  readonly generating = signal(false);
  readonly selectedDayNumber = signal(1);

  readonly selectedDay = computed<ItineraryDay | null>(() => {
    const plan = this.itinerary();
    const number = this.selectedDayNumber();
    return plan?.days.find((day) => day.dayNumber === number) ?? plan?.days[0] ?? null;
  });

  readonly timeline = computed(() => buildTimeline(this.selectedDay()?.items ?? [], this.savedPlaces()));
  readonly highlights = computed(() => highlightCount(this.selectedDay()));
  readonly planEmpty = computed(() => itineraryIsEmpty(this.itinerary()));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.savedError.set('');
    this.itineraryError.set('');
    this.tripsApi.list().subscribe({
      next: ({ trips }) => {
        const today = localTodayIso();
        const trip = selectFeaturedTrip(trips, today);
        this.featured.set(trip);
        if (!trip) {
          this.featuredKind.set('none');
          this.dayCount.set(0);
          this.savedPlaces.set([]);
          this.itinerary.set(null);
          this.pending.set(false);
        } else if (trip.startDate <= today && today <= trip.endDate) {
          this.featuredKind.set('current');
          this.dayCount.set(inclusiveDayCount(trip.startDate, trip.endDate));
          this.loadSaved(trip.id);
          this.loadItinerary(trip.id);
          this.pending.set(false);
        } else {
          this.featuredKind.set('upcoming');
          this.dayCount.set(inclusiveDayCount(trip.startDate, trip.endDate));
          this.loadSaved(trip.id);
          this.loadItinerary(trip.id);
          this.pending.set(false);
        }
      },
      error: () => {
        this.pending.set(false);
        this.featured.set(null);
        this.featuredKind.set('none');
        this.savedPlaces.set([]);
        this.itinerary.set(null);
        this.loadError.set('Could not load your trips. Try again.');
      },
    });
  }

  selectDay(dayNumber: number): void {
    this.selectedDayNumber.set(dayNumber);
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

  generate(): void {
    const trip = this.featured();
    if (!trip) {
      return;
    }
    this.generating.set(true);
    this.itineraryError.set('');
    this.tripsApi.generateItinerary(trip.id).subscribe({
      next: ({ itinerary }) => {
        this.applyItinerary(itinerary);
        this.generating.set(false);
      },
      error: () => {
        this.generating.set(false);
        this.itineraryError.set('Could not generate a plan. Try again.');
      },
    });
  }

  private loadSaved(tripId: string): void {
    this.tripsApi.listPlaces(tripId).subscribe({
      next: ({ places }) => this.savedPlaces.set(places),
      error: () => {
        this.savedPlaces.set([]);
        this.savedError.set('Could not load saved places.');
      },
    });
  }

  private loadItinerary(tripId: string): void {
    this.itineraryPending.set(true);
    this.tripsApi.getItinerary(tripId).subscribe({
      next: ({ itinerary }) => {
        if (!itineraryIsEmpty(itinerary)) {
          this.applyItinerary(itinerary);
          this.itineraryPending.set(false);
          return;
        }
        this.generating.set(true);
        this.tripsApi.generateItinerary(tripId).subscribe({
          next: ({ itinerary: generated }) => {
            this.applyItinerary(generated);
            this.itineraryPending.set(false);
            this.generating.set(false);
          },
          error: () => {
            this.applyItinerary(itinerary);
            this.itineraryPending.set(false);
            this.generating.set(false);
            this.itineraryError.set('Could not generate a plan. Try again.');
          },
        });
      },
      error: () => {
        this.itineraryPending.set(false);
        this.itinerary.set(null);
        this.itineraryError.set('Could not load your itinerary.');
      },
    });
  }

  private applyItinerary(itinerary: Itinerary): void {
    this.itinerary.set(itinerary);
    this.selectedDayNumber.set(selectPlanDayNumber(itinerary, localTodayIso()));
  }

  unsave(place: SavedTripPlace): void {
    this.tripsApi.removePlace(place.tripId, place.placeId).subscribe({
      next: () => {
        this.savedPlaces.set(this.savedPlaces().filter((item) => item.placeId !== place.placeId));
      },
      error: () => {
        this.savedError.set('Could not remove that saved place.');
      },
    });
  }
}
