import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type DailyBudget = 'low' | 'medium' | 'high';
export type TravelStyle = 'relaxed' | 'balanced' | 'packed';
export type TripInterest =
  | 'food'
  | 'nature'
  | 'culture'
  | 'shopping'
  | 'nightlife'
  | 'family'
  | 'adventure'
  | 'wellness';

export interface Trip {
  id: string;
  userId: string;
  destination: string;
  startDate: string;
  endDate: string;
  adultCount: number;
  childCount: number;
  interests: TripInterest[];
  dailyBudget: DailyBudget | null;
  travelStyle: TravelStyle | null;
}

export interface CreateTripRequest {
  destination: string;
  startDate: string;
  endDate: string;
  adultCount: number;
  childCount: number;
  interests: TripInterest[];
  dailyBudget?: DailyBudget | null;
  travelStyle?: TravelStyle | null;
}

export type PlaceCategory =
  | 'airport'
  | 'attraction'
  | 'food'
  | 'lodging'
  | 'transport'
  | 'shopping'
  | 'safety'
  | 'other';

export interface SavedTripPlace {
  tripId: string;
  placeId: string;
  catalogId: string;
  name: string;
  category: PlaceCategory;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  sortOrder: number;
}

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

@Injectable({ providedIn: 'root' })
export class TripService {
  private readonly base = `${environment.apiBaseUrl}/trips`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<{ trips: Trip[] }> {
    return this.http.get<{ trips: Trip[] }>(this.base, { withCredentials: true });
  }

  create(body: CreateTripRequest): Observable<{ trip: Trip }> {
    return this.http.post<{ trip: Trip }>(this.base, body, { withCredentials: true });
  }

  update(id: string, body: Partial<CreateTripRequest>): Observable<{ trip: Trip }> {
    return this.http.patch<{ trip: Trip }>(`${this.base}/${id}`, body, { withCredentials: true });
  }

  listPlaces(tripId: string): Observable<{ places: SavedTripPlace[] }> {
    return this.http.get<{ places: SavedTripPlace[] }>(`${this.base}/${tripId}/places`, {
      withCredentials: true,
    });
  }

  savePlace(tripId: string, placeId: string): Observable<{ place: SavedTripPlace }> {
    return this.http.post<{ place: SavedTripPlace }>(
      `${this.base}/${tripId}/places`,
      { placeId },
      { withCredentials: true },
    );
  }

  removePlace(tripId: string, placeId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${tripId}/places/${encodeURIComponent(placeId)}`, {
      withCredentials: true,
    });
  }
}
