export const SAFETY_TOPICS = [
  'lost_items',
  'scams',
  'transport_disputes',
  'document_loss',
] as const;

export type SafetyTopic = (typeof SAFETY_TOPICS)[number];

export const SAFETY_GUIDE_PATHS = ['/emergency', '/embassies'] as const;
export type SafetyGuidePath = (typeof SAFETY_GUIDE_PATHS)[number];

export const SAFETY_ACCENT = '#0D7652' as const;
export const SAFETY_EMERGENCY_PATH = '/emergency' as const;
export const SAFETY_EMBASSY_PATH = '/embassies' as const;

export const DEFAULT_SAFETY_COUNTRY = 'MY' as const;

export interface SafetyGuideLink {
  label: string;
  path: SafetyGuidePath;
}

export interface SafetyTip {
  id: string;
  topic: SafetyTopic;
  title: string;
  summary: string;
  steps: string[];
  whenToUse: string;
  icon: string;
  links: SafetyGuideLink[];
  sortOrder: number;
}

export interface MalaysiaSafetySeed {
  country: typeof DEFAULT_SAFETY_COUNTRY;
  destination: 'Malaysia';
  version: string;
  disclaimer: string;
  tips: SafetyTip[];
}

export interface SafetyGuideResult {
  country: typeof DEFAULT_SAFETY_COUNTRY;
  destination: 'Malaysia';
  version: string;
  topic: SafetyTopic | null;
  topics: SafetyTopic[];
  disclaimer: string;
  accent: typeof SAFETY_ACCENT;
  emergencyPath: typeof SAFETY_EMERGENCY_PATH;
  embassyPath: typeof SAFETY_EMBASSY_PATH;
  tips: SafetyTip[];
}
