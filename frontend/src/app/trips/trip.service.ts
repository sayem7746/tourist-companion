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
}
