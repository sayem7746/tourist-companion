import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type DietaryPreference =
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'kosher'
  | 'gluten_free'
  | 'dairy_free'
  | 'nut_free'
  | 'pescatarian';

export type MobilityNeed = 'wheelchair' | 'limited_walking' | 'visual_impairment' | 'hearing_impairment';

export type TravelStyle = 'relaxed' | 'balanced' | 'packed';

export interface TouristProfile {
  userId: string;
  email: string;
  displayName: string;
  language: string;
  dietaryPreferences: DietaryPreference[];
  mobilityNeeds: MobilityNeed[];
  travelStyle: TravelStyle | null;
}

export interface ProfilePatch {
  displayName?: string;
  language?: string;
  dietaryPreferences?: DietaryPreference[];
  mobilityNeeds?: MobilityNeed[];
  travelStyle?: TravelStyle | null;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly base = `${environment.apiBaseUrl}/profile`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<{ profile: TouristProfile }> {
    return this.http.get<{ profile: TouristProfile }>(this.base, { withCredentials: true });
  }

  patch(body: ProfilePatch): Observable<{ profile: TouristProfile }> {
    return this.http.patch<{ profile: TouristProfile }>(this.base, body, { withCredentials: true });
  }
}
