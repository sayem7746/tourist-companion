import type { EmergencyContact, EmergencySosCard, MalaysiaEmergencySeed } from './types.js';
import { SOS_COLOR, SOS_PATH } from './types.js';

/** One-tap SOS numbers for `emergency-help` (same contract as concierge SOS). */
export const MALAYSIA_SOS_NUMBERS: EmergencySosCard['numbers'] = [
  { code: '999', label: 'Police, fire, ambulance' },
  { code: '112', label: 'Mobile networks' },
];

export const MALAYSIA_SOS_CARD: EmergencySosCard = {
  color: SOS_COLOR,
  path: SOS_PATH,
  numbers: MALAYSIA_SOS_NUMBERS,
};

const mersNumbers = (agencyLabel: string): EmergencyContact['numbers'] => [
  { code: '999', label: agencyLabel },
  { code: '112', label: 'Mobile networks' },
];

export const MALAYSIA_EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'my-em-police',
    name: 'Police (MERS 999)',
    category: 'police',
    urgency: 'sos',
    numbers: mersNumbers('Police'),
    summary: 'Royal Malaysia Police via the nationwide MERS 999 emergency line.',
    whenToUse:
      'Call now for crime in progress, assault, a missing child in danger, or any threat to life or property. Stay on the line, share your location, and do not use chat instead of this call.',
    area: 'Nationwide',
    hours: '24/7',
    englishSpoken: true,
    source: 'Malaysian Emergency Response Services (MERS 999)',
    sourceUrl: 'https://999.gov.my/',
    sortOrder: 1,
  },
  {
    id: 'my-em-ambulance',
    name: 'Ambulance (MERS 999)',
    category: 'ambulance',
    urgency: 'sos',
    numbers: mersNumbers('Ambulance'),
    summary: 'Ministry of Health ambulance dispatch through MERS 999.',
    whenToUse:
      'Call now for serious injury, chest pain, fainting, trouble breathing, or a child who cannot drink. Say you need an ambulance. This app cannot diagnose or send a vehicle.',
    area: 'Nationwide',
    hours: '24/7',
    englishSpoken: true,
    source: 'Malaysian Emergency Response Services (MERS 999)',
    sourceUrl: 'https://999.gov.my/',
    sortOrder: 2,
  },
  {
    id: 'my-em-fire',
    name: 'Fire and Rescue (MERS 999)',
    category: 'fire',
    urgency: 'sos',
    numbers: mersNumbers('Fire and Rescue'),
    summary: 'Fire and Rescue Department of Malaysia (Bomba) dispatched through MERS 999.',
    whenToUse:
      'Call now for fire, smoke, flood rescue, or people trapped. 999 is the official single emergency number; prefer it over older published fire-only lines.',
    area: 'Nationwide',
    hours: '24/7',
    englishSpoken: true,
    source: 'Malaysian Emergency Response Services (MERS 999)',
    sourceUrl: 'https://999.gov.my/',
    sortOrder: 3,
  },
  {
    id: 'my-em-tourist-police',
    name: 'Tourist Police (Bukit Bintang)',
    category: 'tourist_assistance',
    urgency: 'assistance',
    numbers: [
      { code: '+60321496590', display: '03-2149 6590', label: 'Hotline' },
      { code: '+60321496593', display: '03-2149 6593', label: 'Enquiries' },
    ],
    summary: 'Kuala Lumpur Tourist Police for visitor help in tourist areas.',
    whenToUse:
      'Use for lost property, scams, touts, or directions in Bukit Bintang and other visitor belts. Officers are identified by a red-and-blue “i” badge. If you are in immediate danger, hang up and call 999 or 112.',
    area: 'Kuala Lumpur',
    hours: 'Hotline; use 999 after hours if you are in danger',
    englishSpoken: true,
    source: 'Kuala Lumpur Tourist Police (widely published visitor hotline)',
    sortOrder: 4,
  },
  {
    id: 'my-em-ipk-kl',
    name: 'Kuala Lumpur Police Headquarters (IPK KL)',
    category: 'tourist_assistance',
    urgency: 'assistance',
    numbers: [{ code: '+60321159999', display: '03-2115 9999', label: 'IPK KL' }],
    summary: 'Kuala Lumpur Contingent Police Headquarters switchboard, listed in visitor guides.',
    whenToUse:
      'Use for non-emergency police enquiries in Kuala Lumpur, including how to make a report. Arrival and concierge copy also save this number. Life-threatening emergencies still go to 999 or 112.',
    area: 'Kuala Lumpur',
    hours: 'Switchboard hours; use 999 if you are in danger',
    englishSpoken: true,
    source: 'Kuala Lumpur Contingent Police Headquarters (IPK KL)',
    sortOrder: 5,
  },
  {
    id: 'my-em-tourism-infoline',
    name: 'Tourism Malaysia Info Line',
    category: 'tourist_assistance',
    urgency: 'assistance',
    numbers: [{ code: '1300885050', display: '1300-88-5050', label: 'Info line' }],
    summary: 'Official Tourism Malaysia visitor information line.',
    whenToUse:
      'Ask about destinations, events, and general travel information on working days. Not an emergency or immigration line.',
    area: 'Nationwide',
    hours: 'Working days 09:00–17:00 MYT',
    englishSpoken: true,
    source: 'Tourism Malaysia (Malaysia Tourism Promotion Board)',
    sourceUrl: 'https://www.tourism.gov.my/contact-us/head-office',
    sortOrder: 6,
  },
  {
    id: 'my-em-matic',
    name: 'Malaysia Tourism Centre (MaTiC)',
    category: 'tourist_assistance',
    urgency: 'assistance',
    numbers: [{ code: '+60392354800', display: '03-9235 4800', label: 'Hotline' }],
    summary: 'Official visitor centre on Jalan Ampang with a tourist information counter.',
    whenToUse:
      'Walk in or call for maps, public transport, and trip-planning help. Counter hours are daytime; this is not SOS. Nearby Explore lists the MaTiC desk as a tourist service.',
    area: 'Kuala Lumpur',
    hours: 'Tourist counter 09:00–17:00 daily including public holidays',
    englishSpoken: true,
    source: 'Malaysia Tourism Centre (MaTiC)',
    sourceUrl: 'https://www.matic.gov.my/en/facilities/facilities/tourist-information-counter',
    sortOrder: 7,
  },
];

export const MALAYSIA_EMERGENCY_SEED: MalaysiaEmergencySeed = {
  country: 'MY',
  destination: 'Malaysia',
  version: '2026-09-mvp',
  disclaimer:
    'If you are in immediate danger, call 999 or 112 now. This directory is not a substitute for emergency services. In-app SOS (#E11D48, emergency-help) must stay visible and must not be replaced by chat. Confirm numbers on 999.gov.my if you can.',
  contacts: MALAYSIA_EMERGENCY_CONTACTS,
};
