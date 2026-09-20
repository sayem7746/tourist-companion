import { MALAYSIA_PROMPT_CHIPS } from '../knowledge/content.js';
import type { ConciergeCategory } from '../knowledge/types.js';
import type { ConciergeEscalationLevel } from './types.js';

export type ConciergeOobKind =
  | 'medical'
  | 'booking'
  | 'visa'
  | 'outside_my'
  | 'unsafe'
  | 'legal'
  | 'unknown';

export interface ClassifiedIntent {
  category: ConciergeCategory;
  escalationLevel: ConciergeEscalationLevel;
  chipId?: string;
  articleHint?: string;
  oobKind?: ConciergeOobKind;
}

const GREETING_PATTERN = /^(hi|hello|hey|good (morning|afternoon|evening))[\s!.?]*$/i;

/** Immediate danger: medical, police, fire, assault, missing child, self-harm. */
const EMERGENCY_PATTERNS: RegExp[] = [
  /\bsos\b/i,
  /\b(call|dial)\s*(the )?(police|cops|ambulance|bomba)\b/i,
  /\b(need|get)\b.{0,24}\b(police|ambulance|firefighter|fire department|bomba)\b/i,
  /\b(call|dial)\s*(999|112)\b/i,
  /\b(i am|i'm|we are|we're)\s+being followed\b/i,
  /\b(following me|still following)\b/i,
  /\b(grabbed my (bag|phone|purse)|snatched|mugged|assault|stabbed|robbed me)\b/i,
  /\b(pointed a gun|gunshot|has a gun)\b/i,
  /\b(chest pain|heart attack|can't breathe|cannot breathe|not breathing|chok(e|ing)|stroke|overdose|seizure)\b/i,
  /\b(suicid|kill myself|self-harm|self harm|want to die)\b/i,
  /\b((hotel|building|room|mall) (is |was )?(on )?fire|on fire|there's a fire|there is a fire)\b/i,
  /\b(flood(ing|ed)? (here|now|the (hotel|street|mall))|earthquake|building collapsed)\b/i,
  /\b(missing child|lost (my )?child|child is (gone|missing))\b/i,
  /\b(injured|bleeding( badly)?|unconscious|passed out)\b/i,
  /\b(child (who )?(cannot|can't|can not) drink)\b/i,
  /\b(i('m| am) faint(ing|ed)|someone fainted|fainting)\b/i,
];

const VISA_PATTERNS = [/\bvisa\b/i, /\benentry\b/i, /\bimmigration ruling\b/i, /\bhow long can i stay\b/i];
const BOOKING_PATTERNS = [
  /\bbook( me)?( a)? (table|ticket|reservation)\b/i,
  /\breserve (a |me a )?table\b/i,
  /\bhold a table\b/i,
  /\bpay (for me|on my behalf)\b/i,
];
const MEDICAL_PATTERNS = [
  /\bantibiotic\b/i,
  /\bdiagnos(e|is)\b/i,
  /\bwhich (medicine|pill|drug)\b/i,
  /\bprescribe\b/i,
];
const OUTSIDE_MY_PATTERNS = [
  /\b(singapore|bangkok|phuket|bali|jakarta|tokyo|dubai|paris|london)\b/i,
  /\boutside malaysia\b/i,
];
const UNSAFE_PATTERNS = [
  /\bhow (do i|to) (steal|rob|hack|break in|pick a lock|shoplift)\b/i,
  /\b(buy|sell) (cocaine|heroin|mdma|meth|illegal drugs)\b/i,
  /\b(fake passport|counterfeit (money|notes)|smuggle)\b/i,
  /\b(make|build) a bomb\b/i,
];
const LEGAL_PATTERNS = [
  /\b(should i sue|legal advice|draft a (will|contract)|is this legal)\b/i,
  /\breal-?time crime maps?\b/i,
];

const HANDOFF_PATTERNS: Array<{ re: RegExp; category: ConciergeCategory }> = [
  { re: /\blost (my )?passport\b/i, category: 'safety_non_emergency' },
  { re: /\bpassport (is )?(lost|stolen)\b/i, category: 'safety_non_emergency' },
  { re: /\blost (my )?(phone|wallet|bag|luggage|items?)\b/i, category: 'safety_non_emergency' },
  { re: /\bscam\b/i, category: 'safety_non_emergency' },
  { re: /\b(grab fare|disputed? (fare|grab))\b/i, category: 'safety_non_emergency' },
  { re: /\bcustoms seizure\b/i, category: 'safety_non_emergency' },
  { re: /\blocked out\b/i, category: 'safety_non_emergency' },
  { re: /\b(pharmacy|chemist|clinic hours)\b/i, category: 'safety_non_emergency' },
  { re: /\bstomach bug\b/i, category: 'safety_non_emergency' },
];

const ARRIVAL_PATTERNS = [
  /\bklia2?\b/i,
  /\bimmigration\b/i,
  /\b(sim|esim)\b/i,
  /\b(currency|atm|ringgit after landing)\b/i,
  /\btransfer to (the )?hotel\b/i,
  /\bairport (train|bus|transfer)\b/i,
];

const CATEGORY_PATTERNS: Array<{ category: ConciergeCategory; re: RegExp }> = [
  { category: 'food_spice_diet', re: /\b(spicy|spice|sambal|tak pedas|vegetarian|halal|allerg|kid(s)?[- ]friendly|chicken rice|roti canai)\b/i },
  { category: 'nearby_dining', re: /\b(dinner|lunch|restaurant|near (klcc|bukit)|food map|jalan alor|mamak)\b/i },
  { category: 'local_transport', re: /\b(lrt|mrt|monorail|grab|how to ride|train|touch.?n.?go)\b/i },
  { category: 'money_payments', re: /\b(cash|night market|pasar malam|atm|card|ewallet|tipping|myr|ringgit)\b/i },
  { category: 'culture_etiquette', re: /\b(dress code|batu caves|mosque|temple|phrase|greeting)\b/i },
  { category: 'itinerary_plan', re: /\b(add to plan|petronas|twin towers|klcc park|itinerary|save (this|the) stall)\b/i },
  { category: 'safety_non_emergency', re: /\b(pickpocket|touts?|haze|weather|tap water|heat)\b/i },
  { category: 'arrival_ops', re: /\b(arrival|klia|sim card)\b/i },
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function oob(
  category: ConciergeCategory,
  kind: ConciergeOobKind,
  articleHint?: string,
): ClassifiedIntent {
  return { category, escalationLevel: 'out_of_bounds', articleHint, oobKind: kind };
}

export function classifyIntent(message: string, categoryHint?: ConciergeCategory): ClassifiedIntent {
  const text = message.trim();
  const chip = MALAYSIA_PROMPT_CHIPS.find((item) => item.label.toLowerCase() === text.toLowerCase());
  if (chip) {
    return {
      category: chip.category,
      escalationLevel: 'none',
      chipId: chip.id,
      articleHint: chip.articleId,
    };
  }

  if (matchesAny(text, EMERGENCY_PATTERNS)) {
    return { category: 'emergency', escalationLevel: 'sos', articleHint: 'my-faq-emergency' };
  }

  if (matchesAny(text, UNSAFE_PATTERNS)) {
    return oob('safety_non_emergency', 'unsafe', 'my-faq-unsafe');
  }
  if (matchesAny(text, MEDICAL_PATTERNS)) {
    return oob('safety_non_emergency', 'medical', 'my-faq-pharmacy');
  }
  if (matchesAny(text, BOOKING_PATTERNS)) {
    return oob('itinerary_plan', 'booking', 'my-faq-booking-oob');
  }
  if (matchesAny(text, VISA_PATTERNS)) {
    return oob('arrival_ops', 'visa', 'my-faq-visa-oob');
  }
  if (matchesAny(text, OUTSIDE_MY_PATTERNS)) {
    return oob('itinerary_plan', 'outside_my', 'my-attr-beyond-kl');
  }
  if (matchesAny(text, LEGAL_PATTERNS)) {
    return oob('safety_non_emergency', 'legal', 'my-faq-oob');
  }

  for (const item of HANDOFF_PATTERNS) {
    if (item.re.test(text)) {
      const articleHint =
        /passport/i.test(text) ? 'my-faq-passport'
        : /grab fare|disputed? (fare|grab)/i.test(text) ? 'my-faq-fare-dispute'
        : /lost (my )?(phone|wallet|bag|luggage|items?)/i.test(text) ? 'my-faq-lost-items'
        : /scam|touts/i.test(text) ? 'my-faq-scams'
        : /pharmacy|stomach|clinic/i.test(text) ? 'my-faq-pharmacy'
        : 'my-faq-scams';
      return { category: item.category, escalationLevel: 'handoff', articleHint };
    }
  }

  if (matchesAny(text, ARRIVAL_PATTERNS)) {
    const articleHint = /\bsim|esim\b/i.test(text)
      ? 'my-faq-sim'
      : /\bklia|airport|transfer|ekspres\b/i.test(text)
        ? 'my-transport-airport'
        : 'my-faq-sim';
    return { category: 'arrival_ops', escalationLevel: 'none', articleHint };
  }

  if (categoryHint) {
    return { category: categoryHint, escalationLevel: 'none' };
  }

  for (const item of CATEGORY_PATTERNS) {
    if (item.re.test(text)) {
      return { category: item.category, escalationLevel: 'none' };
    }
  }

  if (GREETING_PATTERN.test(text)) {
    return { category: 'nearby_dining', escalationLevel: 'none' };
  }

  return oob('safety_non_emergency', 'unknown', 'my-faq-oob');
}
