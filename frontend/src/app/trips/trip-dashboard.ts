import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip, TripService } from './trip.service';

export function localTodayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function inclusiveDayCount(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }
  return Math.round((end - start) / 86_400_000) + 1;
}

export function selectFeaturedTrip(trips: Trip[], today: string): Trip | null {
  const current = trips.filter((trip) => trip.startDate <= today && today <= trip.endDate);
  if (current.length > 0) {
    return [...current].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))[0];
  }
  const upcoming = trips.filter((trip) => trip.startDate > today);
  if (upcoming.length > 0) {
    return [...upcoming].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))[0];
  }
  return null;
}

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

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.tripsApi.list().subscribe({
      next: ({ trips }) => {
        const today = localTodayIso();
        const trip = selectFeaturedTrip(trips, today);
        this.featured.set(trip);
        if (!trip) {
          this.featuredKind.set('none');
          this.dayCount.set(0);
        } else if (trip.startDate <= today && today <= trip.endDate) {
          this.featuredKind.set('current');
          this.dayCount.set(inclusiveDayCount(trip.startDate, trip.endDate));
        } else {
          this.featuredKind.set('upcoming');
          this.dayCount.set(inclusiveDayCount(trip.startDate, trip.endDate));
        }
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.featured.set(null);
        this.featuredKind.set('none');
        this.loadError.set('Could not load your trips. Try again.');
      },
    });
  }
}
