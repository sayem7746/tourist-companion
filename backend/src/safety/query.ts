import { MALAYSIA_SAFETY_SEED } from './content.js';
import {
  SAFETY_ACCENT,
  SAFETY_EMBASSY_PATH,
  SAFETY_EMERGENCY_PATH,
  SAFETY_TOPICS,
  type SafetyGuideResult,
  type SafetyTopic,
} from './types.js';

export interface SafetyQuery {
  topic?: SafetyTopic;
}

export function querySafety(filters: SafetyQuery = {}): SafetyGuideResult {
  const tips = MALAYSIA_SAFETY_SEED.tips
    .filter((tip) => (filters.topic ? tip.topic === filters.topic : true))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  return {
    country: MALAYSIA_SAFETY_SEED.country,
    destination: MALAYSIA_SAFETY_SEED.destination,
    version: MALAYSIA_SAFETY_SEED.version,
    topic: filters.topic ?? null,
    topics: [...SAFETY_TOPICS],
    disclaimer: MALAYSIA_SAFETY_SEED.disclaimer,
    accent: SAFETY_ACCENT,
    emergencyPath: SAFETY_EMERGENCY_PATH,
    embassyPath: SAFETY_EMBASSY_PATH,
    tips,
  };
}
