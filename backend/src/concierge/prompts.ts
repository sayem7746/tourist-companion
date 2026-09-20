import type { KnowledgeArticle } from '../knowledge/types.js';
import type { ConciergeLiveContext } from './types.js';

export const SYSTEM_PROMPT = `You are the Malaysia AI Concierge for Tourist Companion: a 24/7 friendly local guide and cultural translator.

Always:
- Answer only from the provided knowledge articles. Do not invent venues, prices, train lines, laws, live wait times, FX, or opening hours.
- Prefer the traveler's live context (area, trip style, diet, mobility).
- Be friendly, specific, and concise. Welcome by first name and area when known.
- Give actionable local detail that appears in the articles (typical MYR bands, spice, how to order, how to get there).
- State uncertainty: prices, waits, and hours are estimates from the seed, not live data.
- Keep replies family-safe when trip mode is family (no nightlife or unsolicited alcohol).
- Deep-link to product surfaces when the articles include a path (/arrival, /arrival/transport, /arrival/sim, /arrival/money, /explore).

Never:
- Speak as emergency services, police, or a hospital. Do not give clinical instructions beyond “get help now.”
- Process payments, hold reservations, or guarantee availability.
- Shame dietary, religious, or mobility needs.
- Answer visas/immigration rulings, medical diagnosis, legal advice, or destinations outside Malaysia.
- Replace the header SOS control. If the user is in immediate danger, stop normal answering.

Return JSON only with keys: text (string), followUpChips (string array from the provided chips only).`;

export function contextBlock(context: ConciergeLiveContext): string {
  const lines = [
    `Area: ${context.area?.trim() || 'unknown'}`,
    `Trip mode: ${context.tripMode?.trim() || 'unknown'}`,
    `First name: ${context.firstName?.trim() || 'unknown'}`,
    `Dietary preferences: ${(context.dietaryPreferences ?? []).join(', ') || 'none stated'}`,
    `Mobility needs: ${(context.mobilityNeeds ?? []).join(', ') || 'none stated'}`,
  ];
  return `Live traveler context:\n${lines.join('\n')}`;
}

export function groundingBlock(articles: KnowledgeArticle[]): string {
  if (articles.length === 0) {
    return 'Grounding articles: none. Say you do not have a verified answer and offer a safer generic step (hotel desk, official app, station staff).';
  }
  return articles
    .map((article, index) => {
      const parts = [
        `[${index + 1}] id=${article.id} category=${article.category} topic=${article.topic}`,
        `title: ${article.title}`,
        `summary: ${article.summary}`,
        `body: ${article.body}`,
      ];
      if (article.typicalMyr) parts.push(`typical MYR (estimate): ${article.typicalMyr}`);
      if (article.area) parts.push(`area: ${article.area}`);
      if (article.deepLink) parts.push(`deepLink: ${article.deepLink}`);
      if (article.phraseTips?.length) {
        parts.push(
          `phrases: ${article.phraseTips.map((tip) => `${tip.phrase} (${tip.meaning})`).join('; ')}`,
        );
      }
      if (article.placeCards?.length) {
        parts.push(
          `places (do not invent others): ${article.placeCards.map((card) => `${card.name} — ${card.why}`).join('; ')}`,
        );
      }
      return parts.join('\n');
    })
    .join('\n\n');
}

export function userTurnBlock(message: string, history: { role: string; content: string }[]): string {
  const prior = history
    .slice(-8)
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join('\n');
  const historyBlock = prior ? `Recent thread:\n${prior}\n\n` : '';
  return `${historyBlock}Current user message:\n${message}`;
}

export const SOS_COPY =
  'Stay safe. Call 999 (police, fire, ambulance) or 112 from a mobile network now, and share your location if you can.';

export const OOB_VISA_COPY =
  'I cannot rule on visas or immigration. Eligibility and length of stay are official Malaysian Immigration matters — use the Immigration Department or your airline. Arrival at KLIA (MDAC, queues) is in the Arrival checklist.';

export const OOB_MEDICAL_COPY =
  'I cannot diagnose or choose an antibiotic. For mild symptoms, a pharmacist at Watson’s, Guardian, or a 7-Eleven can help. If there is bleeding, fainting, chest pain, or a child who cannot drink, use SOS and call 999 / 112.';

export const OOB_BOOKING_COPY =
  'I cannot book a table, buy tickets, or pay on your behalf. Use Show on Map or Add to Plan, or ask in person.';

export const OOB_OUTSIDE_MY_COPY =
  'I only cover Malaysia. I will not invent answers for other countries. Ask about KL, Penang, Melaka, Langkawi, or another in-country plan.';

export const OOB_GENERIC_COPY =
  'That is outside what this concierge can do. I can help with food, transport, payments, etiquette, arrival steps, and everyday safety in Malaysia — or SOS if you are in danger.';
