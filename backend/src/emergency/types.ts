export const EMERGENCY_CATEGORIES = [
  'police',
  'ambulance',
  'fire',
  'tourist_assistance',
] as const;

export type EmergencyCategory = (typeof EMERGENCY_CATEGORIES)[number];

export const EMERGENCY_URGENCIES = ['sos', 'assistance'] as const;
export type EmergencyUrgency = (typeof EMERGENCY_URGENCIES)[number];

export const DEFAULT_EMERGENCY_COUNTRY = 'MY' as const;

export const SOS_COLOR = '#E11D48' as const;
export const SOS_PATH = 'emergency-help' as const;

export interface EmergencyNumber {
  /** Digits for a `tel:` link (short codes 999/112, otherwise E.164). */
  code: string;
  label: string;
  /** Pretty local format when different from `code`. */
  display?: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  category: EmergencyCategory;
  urgency: EmergencyUrgency;
  numbers: EmergencyNumber[];
  summary: string;
  whenToUse: string;
  area: string;
  hours: string;
  englishSpoken?: boolean;
  source: string;
  sourceUrl?: string;
  sortOrder: number;
}

export interface MalaysiaEmergencySeed {
  country: typeof DEFAULT_EMERGENCY_COUNTRY;
  destination: 'Malaysia';
  version: string;
  disclaimer: string;
  contacts: EmergencyContact[];
}

export interface EmergencySosCard {
  color: typeof SOS_COLOR;
  path: typeof SOS_PATH;
  numbers: Array<{ code: string; label: string }>;
}

export interface EmergencyDirectoryResult {
  country: typeof DEFAULT_EMERGENCY_COUNTRY;
  destination: 'Malaysia';
  version: string;
  category: EmergencyCategory | null;
  urgency: EmergencyUrgency | null;
  categories: EmergencyCategory[];
  disclaimer: string;
  sos: EmergencySosCard;
  contacts: EmergencyContact[];
}
