import { MALAYSIA_PROMPT_CHIPS } from '../knowledge/content.js';
import type { ConciergeCategory } from '../knowledge/types.js';
import type { ConciergeEscalationLevel } from './types.js';

export interface ClassifiedIntent {
  category: ConciergeCategory;
  escalationLevel: ConciergeEscalationLevel;
  chipId?: string;
  articleHint?: string;
}

const EMERGENCY_PATTERNS: RegExp[] = [
  /\b(sos|call the police|call police|call 999|call 112)\b/i,
  /\b(i am|i'm|we are|we're)\s+being followed\b/i,
  /\b(following me|still following)\b/i,
  /\b(grabbed my (bag|phone|purse)|snatched|mugged|assault|stabbed|gun|robbed me)\b/i,
  /\b(chest pain|heart attack|can't breathe|cannot breathe|not breathing)\b/i,
  /\b(suicide|kill myself|self-harm|self harm)\b/i,
  /\b(fire|flood|earthquake|collapsed)\b/i,
  /\b(missing child|lost (my )?child|child is (gone|missing))\b/i,
  /\b(injured|bleeding badly|unconscious)\b/i,
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

const HANDOFF_PATTERNS: Array<{ re: RegExp; category: ConciergeCategory }> = [
  { re: /\blost (my )?passport\b/i, category: 'safety_non_emergency' },
  { re: /\bpassport (is )?(lost|stolen)\b/i, category: 'safety_non_emergency' },
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

  if (matchesAny(text, MEDICAL_PATTERNS)) {
    return { category: 'safety_non_emergency', escalationLevel: 'out_of_bounds', articleHint: 'my-faq-pharmacy' };
  }
  if (matchesAny(text, BOOKING_PATTERNS)) {
    return { category: 'itinerary_plan', escalationLevel: 'out_of_bounds', articleHint: 'my-faq-booking-oob' };
  }
  if (matchesAny(text, VISA_PATTERNS)) {
    return { category: 'arrival_ops', escalationLevel: 'out_of_bounds', articleHint: 'my-faq-visa-oob' };
  }
  if (matchesAny(text, OUTSIDE_MY_PATTERNS)) {
    return { category: 'itinerary_plan', escalationLevel: 'out_of_bounds', articleHint: 'my-attr-beyond-kl' };
  }

  for (const item of HANDOFF_PATTERNS) {
    if (item.re.test(text)) {
      const articleHint =
        /passport/i.test(text) ? 'my-faq-passport'
        : /scam|touts|grab fare/i.test(text) ? 'my-faq-scams'
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

  return { category: 'nearby_dining', escalationLevel: 'none' };
}
