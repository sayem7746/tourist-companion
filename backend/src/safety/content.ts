import type { MalaysiaSafetySeed, SafetyTip } from './types.js';

export const MALAYSIA_SAFETY_TIPS: SafetyTip[] = [
  {
    id: 'my-safety-lost-items',
    topic: 'lost_items',
    title: 'Lost phone, wallet, or bag',
    summary:
      'Retrace your last stops, tell the hotel or venue, then file a police report if the item is still missing.',
    steps: [
      'Stay put if it is safe and retrace your last stops (hotel, Grab drop-off, mall desk).',
      'Ask the venue lost-and-found and your hotel concierge.',
      'Freeze cards and change passwords from another device.',
      'File a police report with Tourist Police for insurance or replacement IDs.',
      'If you are being followed or threatened, stop searching and call 999 or 112.',
    ],
    whenToUse:
      'Use after a phone, wallet, or bag goes missing and you are not in immediate danger. This is not a live lost-and-found desk.',
    icon: 'inventory_2',
    links: [{ label: 'Tourist Police and SOS', path: '/emergency' }],
    sortOrder: 1,
  },
  {
    id: 'my-safety-scams',
    topic: 'scams',
    title: 'Everyday scams and touts',
    summary:
      'Ignore unsolicited gem, tailoring, and “closed temple” stories. Use official apps and posted taxi booths.',
    steps: [
      'Walk on if someone says your attraction is closed and offers a taxi tour.',
      'Skip unofficial airport greeters; use Grab or a posted coupon-taxi booth.',
      'Agree handicraft prices before you buy. Keep bags zipped and in front in crowds.',
      'Do not hand over your passport or pay a “fine” to someone without a clear official badge.',
      'If someone will not let you leave or you feel threatened, call 999 or 112.',
    ],
    whenToUse:
      'Use for touts, fake “closed” sights, and street pressure in tourist belts. This is not a live crime map.',
    icon: 'policy',
    links: [{ label: 'Tourist Police and SOS', path: '/emergency' }],
    sortOrder: 2,
  },
  {
    id: 'my-safety-transport',
    topic: 'transport_disputes',
    title: 'Grab and taxi fare disputes',
    summary:
      'Screenshot the trip, use in-app help or the hotel desk, and do not argue in the street.',
    steps: [
      'Screenshot the Grab trip, fare, and driver details before you close the app.',
      'Use in-app help or your hotel desk rather than arguing curbside.',
      'At KLIA, use the official coupon-taxi booth instead of arrivals-hall touts.',
      'In a metered city taxi, confirm the meter is on before you sit down.',
      'Tourist Police can take a report; call 999 or 112 if you feel unsafe.',
    ],
    whenToUse:
      'Use for disputed Grab fares, meter arguments, or unofficial airport taxis. Not for a crash or assault — that is SOS.',
    icon: 'local_taxi',
    links: [{ label: 'Tourist Police and SOS', path: '/emergency' }],
    sortOrder: 3,
  },
  {
    id: 'my-safety-documents',
    topic: 'document_loss',
    title: 'Lost or stolen passport',
    summary:
      'File a police report first, then open your embassy or high commission from the in-app directory.',
    steps: [
      'File a police report first (Tourist Police in visitor areas such as Bukit Bintang).',
      'Open your embassy or high commission from the in-app directory — official websites only.',
      'Keep a photo of the passport biodata page stored separately from the booklet.',
      'Visa, MDAC, and length-of-stay questions belong to official immigration, not this app.',
      'If you are in immediate danger, call 999 or 112 instead of waiting for consular hours.',
    ],
    whenToUse:
      'Use after a lost or stolen passport when you are safe. This is not visa advice and not a substitute for 999.',
    icon: 'badge',
    links: [
      { label: 'Emergency help', path: '/emergency' },
      { label: 'Find your embassy', path: '/embassies' },
    ],
    sortOrder: 4,
  },
];

export const MALAYSIA_SAFETY_SEED: MalaysiaSafetySeed = {
  country: 'MY',
  destination: 'Malaysia',
  version: '2026-09-mvp',
  disclaimer:
    'If you are in immediate danger, call 999 or 112 now. These tips are everyday guidance, not legal, medical, or immigration advice, and they do not replace Tourist Police or your embassy.',
  tips: MALAYSIA_SAFETY_TIPS,
};
