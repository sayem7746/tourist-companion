import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  inclusiveDayCount,
  localTodayIso,
  selectFeaturedTrip,
  Trip,
  TripService,
  type SavedTripPlace,
} from './trip.service';

export { inclusiveDayCount, localTodayIso, selectFeaturedTrip } from './trip.service';

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

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.savedError.set('');
    this.tripsApi.list().subscribe({
      next: ({ trips }) => {
        const today = localTodayIso();
        const trip = selectFeaturedTrip(trips, today);
        this.featured.set(trip);
        if (!trip) {
          this.featuredKind.set('none');
          this.dayCount.set(0);
          this.savedPlaces.set([]);
          this.pending.set(false);
        } else if (trip.startDate <= today && today <= trip.endDate) {
          this.featuredKind.set('current');
          this.dayCount.set(inclusiveDayCount(trip.startDate, trip.endDate));
          this.loadSaved(trip.id);
        } else {
          this.featuredKind.set('upcoming');
          this.dayCount.set(inclusiveDayCount(trip.startDate, trip.endDate));
          this.loadSaved(trip.id);
        }
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.featured.set(null);
        this.featuredKind.set('none');
        this.savedPlaces.set([]);
        this.loadError.set('Could not load your trips. Try again.');
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
