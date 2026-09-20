export const DIETARY_PREFERENCES = [
  'vegetarian',
  'vegan',
  'halal',
  'kosher',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'pescatarian',
] as const;

export const MOBILITY_NEEDS = [
  'wheelchair',
  'limited_walking',
  'visual_impairment',
  'hearing_impairment',
] as const;

export const TRAVEL_STYLES = ['relaxed', 'balanced', 'packed'] as const;

export type DietaryPreference = (typeof DIETARY_PREFERENCES)[number];
export type MobilityNeed = (typeof MOBILITY_NEEDS)[number];
export type TravelStyle = (typeof TRAVEL_STYLES)[number];

export interface TouristProfile {
  userId: string;
  email: string;
  displayName: string;
  language: string;
  dietaryPreferences: DietaryPreference[];
  mobilityNeeds: MobilityNeed[];
  travelStyle: TravelStyle | null;
}

export interface ProfilePreferencesPatch {
  displayName?: string;
  language?: string;
  dietaryPreferences?: DietaryPreference[];
  mobilityNeeds?: MobilityNeed[];
  travelStyle?: TravelStyle | null;
}

export interface ProfileStore {
  getOrCreate(userId: string): Promise<TouristProfile | undefined>;
  update(userId: string, patch: ProfilePreferencesPatch): Promise<TouristProfile | undefined>;
}
