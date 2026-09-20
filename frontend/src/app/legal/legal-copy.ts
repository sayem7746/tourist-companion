import {
  REFERRAL_DISCLOSURE as PARTNER_REFERRAL_DISCLOSURE,
  SPONSORED_BADGE_LABEL,
} from '../partners/partner.service';

export const LEGAL_UPDATED = '20 September 2026';
export const APP_NAME = 'Malaysia Companion';

/** Same traveler-facing line as partner cards (`docs/partner-categories.md`). */
export const REFERRAL_DISCLOSURE = PARTNER_REFERRAL_DISCLOSURE;
export const SPONSORED_LABEL = SPONSORED_BADGE_LABEL;

export const MEDICAL_DISCLAIMER =
  'Malaysia Companion is not a medical service. The AI concierge cannot diagnose illness, prescribe or recommend medicines (including antibiotics), or tell you whether a clinic visit is required. For mild symptoms, ask a pharmacist at a Watson’s, Guardian, or 7-Eleven. If there is bleeding, fainting, chest pain, trouble breathing, or a child who cannot drink, call 999 or 112 now and open Emergency help.';

export const AI_LIMITATIONS: string[] = [
  'The concierge is a Malaysia travel guide, not a doctor, lawyer, immigration officer, or booking agent.',
  'Answers come from curated knowledge and, when enabled, a third-party language model. Prices, wait times, and hours are estimates — not live bookings or official rulings.',
  'It will not process payments, hold reservations, guarantee availability, or invent venues, train lines, or laws.',
  'It will not rule on visas or immigration, give legal advice, or provide a live crime map.',
  'If you are in immediate danger, stop chatting. Use SOS and call 999 or 112. Emergency turns are not stored.',
];

export type LegalTone = 'default' | 'referral' | 'ai' | 'medical';

export interface LegalSection {
  id: string;
  tone: LegalTone;
  icon: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export const PRIVACY_TITLE = 'Privacy notice';
export const PRIVACY_LEDE =
  'This MVP notice explains what Malaysia Companion collects for a Malaysia trip, how we use it, and when third parties (including an AI model) are involved. It is product documentation for launch, not a substitute for counsel-reviewed PDPA wording.';

export const TERMS_TITLE = 'Terms of use';
export const TERMS_LEDE =
  'These MVP terms cover using Malaysia Companion as a travel helper. They are not a booking contract, medical advice, or a visa ruling.';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: 'referral-disclosure',
    tone: 'referral',
    icon: 'handshake',
    title: 'Referral disclosure',
    paragraphs: [
      REFERRAL_DISCLOSURE,
      `When you open a partner booking link we record a click (and optional lead) so we can attribute a later booking. Paid placement also shows a gold ${SPONSORED_LABEL} badge. Organic affiliates still show this disclosure; they omit the badge. Partner commission rates and ops emails stay off traveler screens. Referral links never appear on SOS, emergency numbers, or embassy official contacts.`,
    ],
  },
  {
    id: 'ai-limitations',
    tone: 'ai',
    icon: 'smart_toy',
    title: 'AI processing and limits',
    paragraphs: [
      'When the concierge language model is enabled, your question plus live trip context (first name, area, dates, itinerary, accommodation, diet, and mobility) may be sent to a third-party AI processor. This MVP does not pin that processor to Malaysia or set a zero-retention flag. Do not paste passport numbers, payment card data, or detailed health information into chat.',
    ],
    bullets: AI_LIMITATIONS,
  },
  {
    id: 'medical-disclaimer',
    tone: 'medical',
    icon: 'medical_services',
    title: 'Medical disclaimer',
    paragraphs: [MEDICAL_DISCLAIMER],
  },
  {
    id: 'who',
    tone: 'default',
    icon: 'travel_explore',
    title: 'Who we are',
    paragraphs: [
      `${APP_NAME} (Tourist Companion) is a trip helper for visitors to Malaysia: arrival steps, nearby places, itinerary planning, partner referrals, an AI concierge, and emergency, embassy, and safety directories.`,
    ],
  },
  {
    id: 'collect',
    tone: 'default',
    icon: 'database',
    title: 'What we collect',
    paragraphs: ['Depending on how you use the app, we may process:'],
    bullets: [
      'Account: email, display name, password (stored as a hash), language, dietary preferences, mobility needs, and travel style.',
      'Trip: destination, dates, party size, interests, budget, itinerary stops, and optional booking links.',
      'Location: when you use Explore nearby, a map origin (your coordinates or a default Kuala Lumpur pin) to look up places.',
      'Concierge: messages you type. Signed-in chats with a current trip may be saved (last 20 messages, 7 days). SOS and emergency turns are never stored. Anonymous chats stay on your device only.',
      'Referrals: partner, channel (arrival, explore, concierge, itinerary), and click or lead events.',
      'Technical: an HttpOnly session cookie (tc_access, typically 7 days) and routine request logs. We do not log password plaintext.',
    ],
  },
  {
    id: 'use',
    tone: 'default',
    icon: 'tune',
    title: 'How we use it',
    paragraphs: [
      'We use this data to sign you in, save trips and preferences, generate a draft itinerary, show nearby places and weather hints, run the concierge, attribute partner referrals, and keep the service secure. Weather hints may call Open-Meteo; nearby search may call Google Places or OpenStreetMap Overpass when those providers are configured, otherwise we use our Malaysia seed.',
    ],
  },
  {
    id: 'cookies',
    tone: 'default',
    icon: 'cookie',
    title: 'Cookies and session',
    paragraphs: [
      'The tc_access cookie is required to stay signed in. It is HttpOnly and SameSite=Lax (Secure in production). Signing out clears the cookie in this browser; a copied token may remain valid until it expires (default 7 days).',
    ],
  },
  {
    id: 'choices',
    tone: 'default',
    icon: 'manage_accounts',
    title: 'Your choices',
    paragraphs: ['You can:'],
    bullets: [
      'Use public guides (arrival, explore, concierge, emergency, safety, privacy, and terms) without an account.',
      'Delete saved concierge chat from the Concierge tab when you are signed in with a trip.',
      'Update display name and travel preferences on Profile.',
      'Request account deletion by contacting the operator from the email on your account until a self-serve delete ships.',
    ],
  },
  {
    id: 'children',
    tone: 'default',
    icon: 'family_restroom',
    title: 'Children',
    paragraphs: [
      'The product is aimed at adult travelers planning a trip, including family trips. We do not knowingly create accounts for children under 13.',
    ],
  },
  {
    id: 'pdpa',
    tone: 'default',
    icon: 'gavel',
    title: 'Malaysia PDPA',
    paragraphs: [
      'We treat account, trip, and concierge content as personal data. Partner ops emails and commission rates are kept off tourist screens. This notice will be replaced after legal review before a commercial launch outside the MVP.',
    ],
  },
  {
    id: 'contact',
    tone: 'default',
    icon: 'mail',
    title: 'Contact',
    paragraphs: [
      'For access or deletion requests, use the email on your account, or the operator contact published at launch.',
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'referral-disclosure',
    tone: 'referral',
    icon: 'handshake',
    title: 'Referral disclosure',
    paragraphs: [
      REFERRAL_DISCLOSURE,
      `Sponsored listings also show a gold ${SPONSORED_LABEL} badge. Organic affiliates still disclose; they omit the badge. We never attach referrals to SOS, emergency numbers, or immigration rulings. The app never books or charges you — outbound booking happens on the partner’s site.`,
    ],
  },
  {
    id: 'ai-limitations',
    tone: 'ai',
    icon: 'smart_toy',
    title: 'AI limitations',
    paragraphs: [
      'The Malaysia AI Concierge is a local guide and cultural translator. Treat replies as travel help, not professional advice.',
    ],
    bullets: AI_LIMITATIONS,
  },
  {
    id: 'medical-disclaimer',
    tone: 'medical',
    icon: 'medical_services',
    title: 'Medical disclaimer',
    paragraphs: [MEDICAL_DISCLAIMER],
  },
  {
    id: 'service',
    tone: 'default',
    icon: 'info',
    title: 'The service',
    paragraphs: [
      `${APP_NAME} provides information and tools for visiting Malaysia: arrival checklists, nearby discovery, itinerary drafts, partner links, concierge chat, and emergency, embassy, and safety directories. Official immigration, police, hospitals, and partner businesses remain responsible for their own services.`,
    ],
  },
  {
    id: 'no-agency',
    tone: 'default',
    icon: 'storefront',
    title: 'No booking agency',
    paragraphs: [
      'We do not sell tickets, hold hotel rooms, collect payments, or act as your travel agent. Opening a partner link leaves this app. Availability, prices, and cancellations are the partner’s.',
    ],
  },
  {
    id: 'safety',
    tone: 'default',
    icon: 'health_and_safety',
    title: 'Safety and official help',
    paragraphs: [
      'Emergency numbers, safety tips, and embassy links are guidance. This app cannot dispatch vehicles or share GPS automatically. They do not replace Tourist Police, your embassy, or calling 999 or 112.',
    ],
  },
  {
    id: 'account',
    tone: 'default',
    icon: 'badge',
    title: 'Your account',
    paragraphs: [
      'Keep your password private. You must be able to enter a contract (typically 18+). Do not misuse the concierge for illegal or unsafe requests. We may suspend accounts that abuse the API or impersonate emergency services.',
    ],
  },
  {
    id: 'acceptable-use',
    tone: 'default',
    icon: 'policy',
    title: 'Acceptable use',
    paragraphs: [
      'Do not scrape or attack the service, submit other people’s personal data without a basis, or treat concierge answers as visas, prescriptions, or legal opinions.',
    ],
  },
  {
    id: 'liability',
    tone: 'default',
    icon: 'balance',
    title: 'Liability',
    paragraphs: [
      'Information can be incomplete or out of date. To the extent allowed by law, we are not liable for bookings you make with partners, medical outcomes, immigration decisions, or emergency response. Malaysian law is the default for this MVP until counsel sets governing law for a commercial launch.',
    ],
  },
  {
    id: 'changes',
    tone: 'default',
    icon: 'update',
    title: 'Changes',
    paragraphs: [
      `We may update these pages. The date at the top (${LEGAL_UPDATED}) is the current MVP version. Continued use after an update means you accept the revised notice.`,
    ],
  },
];

export function legalSection(sections: LegalSection[], id: string): LegalSection | undefined {
  return sections.find((section) => section.id === id);
}
