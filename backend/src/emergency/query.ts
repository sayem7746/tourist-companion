import { MALAYSIA_EMERGENCY_SEED, MALAYSIA_SOS_CARD } from './content.js';
import type { EmergencyCategory, EmergencyDirectoryResult, EmergencyUrgency } from './types.js';
import { EMERGENCY_CATEGORIES } from './types.js';

export interface EmergencyQuery {
  category?: EmergencyCategory;
  urgency?: EmergencyUrgency;
}

export function queryEmergency(filters: EmergencyQuery = {}): EmergencyDirectoryResult {
  const contacts = MALAYSIA_EMERGENCY_SEED.contacts
    .filter((contact) => (filters.category ? contact.category === filters.category : true))
    .filter((contact) => (filters.urgency ? contact.urgency === filters.urgency : true))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  return {
    country: MALAYSIA_EMERGENCY_SEED.country,
    destination: MALAYSIA_EMERGENCY_SEED.destination,
    version: MALAYSIA_EMERGENCY_SEED.version,
    category: filters.category ?? null,
    urgency: filters.urgency ?? null,
    categories: [...EMERGENCY_CATEGORIES],
    disclaimer: MALAYSIA_EMERGENCY_SEED.disclaimer,
    sos: MALAYSIA_SOS_CARD,
    contacts,
  };
}
