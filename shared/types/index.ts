/** Shared domain types for frontend and backend. */

export type UserId = string;
export type TripId = string;
export type PlaceId = string;
export type ProviderId = string;
export type ReferralId = string;

export interface User {
  id: UserId;
  email: string;
  displayName: string;
}

export type DietaryPreference =
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'kosher'
  | 'gluten_free'
  | 'dairy_free'
  | 'nut_free'
  | 'pescatarian';

export type MobilityNeed =
  | 'wheelchair'
  | 'limited_walking'
  | 'visual_impairment'
  | 'hearing_impairment';

export type TravelStyle = 'relaxed' | 'balanced' | 'packed';

export interface TouristProfile {
  userId: UserId;
  email: string;
  displayName: string;
  language: string;
  dietaryPreferences: DietaryPreference[];
  mobilityNeeds: MobilityNeed[];
  travelStyle: TravelStyle | null;
}

export interface Trip {
  id: TripId;
  userId: UserId;
  destination: string;
  startDate: string;
  endDate: string;
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
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

export interface Place {
  id: PlaceId;
  name: string;
  category: PlaceCategory;
  city?: string;
  country?: string;
}

export type ProviderCategory =
  | 'transport'
  | 'lodging'
  | 'activity'
  | 'sim'
  | 'insurance'
  | 'other';

export interface Provider {
  id: ProviderId;
  name: string;
  slug: string;
  category: ProviderCategory;
  isActive: boolean;
}

export type ReferralStatus = 'pending' | 'clicked' | 'converted' | 'expired';

export interface Referral {
  id: ReferralId;
  userId: UserId;
  tripId?: TripId;
  providerId: ProviderId;
  placeId?: PlaceId;
  referralCode: string;
  status: ReferralStatus;
}
