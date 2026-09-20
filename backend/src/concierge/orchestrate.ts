import { randomUUID } from 'node:crypto';
import type { KnowledgeArticle, KnowledgePhraseTip, KnowledgePlaceCard } from '../knowledge/types.js';
import { classifyIntent, type ConciergeOobKind } from './classify.js';
import { MALAYSIA_PROMPT_CHIPS } from '../knowledge/content.js';
import { parseLlmJson, type LlmClient } from './llm.js';
import {
  contextBlock,
  groundingBlock,
  OOB_BOOKING_COPY,
  OOB_GENERIC_COPY,
  OOB_LEGAL_COPY,
  OOB_MEDICAL_COPY,
  OOB_OUTSIDE_MY_COPY,
  OOB_UNSAFE_COPY,
  OOB_VISA_COPY,
  SOS_COPY,
  SYSTEM_PROMPT,
  userTurnBlock,
} from './prompts.js';
import { filterFamilySafeChips, isFamilyTrip, retrieveAndRank, uniqueStrings } from './retrieve.js';
import {
  SOS_CARD,
  TRUST_LINE,
  type ConciergeChatRequest,
  type ConciergeChatResponse,
  type ConciergeLiveContext,
  type ConciergeMode,
  type ConciergeReply,
} from './types.js';

const ARRIVAL_SUMMARY_MAX_SENTENCES = 4;

export interface OrchestrateDeps {
  llm?: LlmClient;
  useLlm: boolean;
}

function firstNameFromDisplay(displayName?: string): string | undefined {
  const first = displayName?.trim().split(/\s+/)[0];
  return first || undefined;
}

function inferArea(message: string, explicit?: string): string | undefined {
  if (explicit?.trim()) return explicit.trim();
  if (/\bbukit bintang\b/i.test(message)) return 'Bukit Bintang';
  if (/\bklcc\b/i.test(message)) return 'KLCC';
  if (/\bbatu caves\b/i.test(message)) return 'Batu Caves';
  return undefined;
}

function inferTripMode(message: string, explicit?: string): string | undefined {
  if (explicit?.trim()) return explicit.trim();
  if (/\bfamily\b|\bkids?\b/i.test(message)) return 'family';
  return undefined;
}

function pickList(requestValue: string[] | undefined, storedValue: string[] | undefined): string[] | undefined {
  if (requestValue !== undefined) return requestValue;
  return storedValue;
}

export function mergeContext(
  request: ConciergeChatRequest,
  user?: { displayName: string },
  stored?: ConciergeLiveContext,
): ConciergeLiveContext {
  const requestCtx = request.context ?? {};
  const base = { ...(stored ?? {}), ...requestCtx };
  return {
    ...base,
    area: inferArea(request.message, requestCtx.area ?? stored?.area),
    tripMode: inferTripMode(request.message, requestCtx.tripMode ?? stored?.tripMode),
    firstName:
      requestCtx.firstName?.trim() || stored?.firstName?.trim() || firstNameFromDisplay(user?.displayName),
    dietaryPreferences: pickList(requestCtx.dietaryPreferences, stored?.dietaryPreferences),
    mobilityNeeds: pickList(requestCtx.mobilityNeeds, stored?.mobilityNeeds),
    itinerary: pickList(requestCtx.itinerary, stored?.itinerary),
    interests: pickList(requestCtx.interests, stored?.interests),
  };
}

function welcomePrefix(context: ConciergeLiveContext): string | undefined {
  const area = context.area?.trim();
  const name = context.firstName?.trim();
  if (area && name) {
    return `Welcome to ${area}, ${name}!`;
  }
  if (area) {
    return `Welcome to ${area}.`;
  }
  return undefined;
}

function sentences(text: string, max: number): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, max).join(' ');
}

function cannedSosReply(): ConciergeReply {
  return {
    text: SOS_COPY,
    placeCards: [],
    phraseTips: [],
    followUpChips: [],
    trustLine: null,
    sos: SOS_CARD,
  };
}

function outOfBoundsCopy(kind?: ConciergeOobKind): string {
  switch (kind) {
    case 'medical':
      return OOB_MEDICAL_COPY;
    case 'booking':
      return OOB_BOOKING_COPY;
    case 'visa':
      return OOB_VISA_COPY;
    case 'outside_my':
      return OOB_OUTSIDE_MY_COPY;
    case 'unsafe':
      return OOB_UNSAFE_COPY;
    case 'legal':
      return OOB_LEGAL_COPY;
    default:
      return OOB_GENERIC_COPY;
  }
}

function cannedEscalation(level: ConciergeChatResponse['escalationLevel']): boolean {
  return level === 'sos' || level === 'out_of_bounds';
}

function collectCards(articles: KnowledgeArticle[]): KnowledgePlaceCard[] {
  const cards: KnowledgePlaceCard[] = [];
  const seen = new Set<string>();
  for (const article of articles) {
    for (const card of article.placeCards ?? []) {
      const key = card.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(card);
    }
  }
  return cards;
}

function collectPhrases(articles: KnowledgeArticle[]): KnowledgePhraseTip[] {
  const tips: KnowledgePhraseTip[] = [];
  const seen = new Set<string>();
  for (const article of articles) {
    for (const tip of article.phraseTips ?? []) {
      const key = tip.phrase.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tips.push(tip);
    }
  }
  return tips;
}

function collectChips(articles: KnowledgeArticle[], extra: string[], tripMode?: string): string[] {
  const chips = uniqueStrings([
    ...extra,
    ...articles.flatMap((article) => article.followUpChips ?? []),
  ]);
  return filterFamilySafeChips(chips, tripMode).slice(0, 5);
}

function trustLineFor(articles: KnowledgeArticle[], escalation: ConciergeChatResponse['escalationLevel']): string | null {
  if (escalation !== 'none') return null;
  if (articles.length === 0) return null;
  if (!articles.every((article) => article.trustLineEligible)) return null;
  return TRUST_LINE;
}

function composeRetrieveReply(
  intent: ReturnType<typeof classifyIntent>,
  context: ConciergeLiveContext,
  articles: KnowledgeArticle[],
): ConciergeReply {
  if (intent.escalationLevel === 'sos') {
    return cannedSosReply();
  }

  if (intent.escalationLevel === 'out_of_bounds') {
    const kind = intent.oobKind;
    const refuseOnly = kind === 'unsafe' || kind === 'unknown' || kind === 'legal';
    const primary = refuseOnly ? undefined : articles[0];
    const inBoundsChips = MALAYSIA_PROMPT_CHIPS.map((chip) => chip.label);
    const followUpChips =
      kind === 'unsafe'
        ? []
        : kind === 'unknown' || kind === 'legal'
          ? filterFamilySafeChips(inBoundsChips, context.tripMode).slice(0, 5)
          : collectChips(articles, [], context.tripMode);
    return {
      text: [outOfBoundsCopy(kind), primary ? sentences(primary.body, 2) : undefined].filter(Boolean).join(' '),
      placeCards: [],
      phraseTips: refuseOnly ? [] : collectPhrases(articles).slice(0, 2),
      followUpChips,
      deepLink: primary?.deepLink,
      trustLine: null,
      sos: null,
    };
  }

  const narrative =
    articles.find((article) => article.category === intent.category) ?? articles[0];
  const extraSummaries = articles
    .filter((article) => article.id !== narrative?.id)
    .slice(0, 2)
    .map((article) => article.summary);
  const welcome = welcomePrefix(context);
  const family = isFamilyTrip(context);
  const priceNote = narrative?.typicalMyr
    ? family
      ? `Typical prices (estimate, not live): ${narrative.typicalMyr}.`
      : `Typical MYR band (estimate): ${narrative.typicalMyr}.`
    : undefined;
  const body = narrative
    ? intent.category === 'arrival_ops'
      ? sentences(narrative.body, ARRIVAL_SUMMARY_MAX_SENTENCES)
      : [narrative.summary, ...extraSummaries, priceNote].filter(Boolean).join(' ')
    : 'I do not have a verified seed article for that yet. Ask hotel desk or station staff rather than guessing live details.';

  const extraChips: string[] = [];
  if (family && intent.category === 'food_spice_diet') {
    extraChips.push('Ask about vegetarian options', 'Bukit Bintang Food Map', 'Directions to Jalan Alor');
  }

  const mobility = context.mobilityNeeds?.length
    ? ` Mobility note from your profile: ${context.mobilityNeeds.join(', ')} — ask station staff for lifts where needed.`
    : '';
  const diet = context.dietaryPreferences?.length
    ? ` I will keep ${context.dietaryPreferences.join(', ')} in mind when suggesting how to order.`
    : '';

  const handoffNote =
    intent.escalationLevel === 'handoff'
      ? ' If this gets worse, use SOS. I am not a lawyer or clinic.'
      : '';

  return {
    text: [welcome, body + diet + mobility + handoffNote].filter(Boolean).join(' '),
    placeCards: collectCards(articles),
    phraseTips: collectPhrases(articles),
    followUpChips: collectChips(articles, extraChips, context.tripMode),
    deepLink: narrative?.deepLink,
    trustLine: trustLineFor(articles, intent.escalationLevel),
    sos: null,
  };
}

function allowedChipSet(articles: KnowledgeArticle[]): Set<string> {
  return new Set(
    articles.flatMap((article) => article.followUpChips ?? []).map((chip) => chip.toLowerCase()),
  );
}

export async function orchestrateConciergeChat(
  request: ConciergeChatRequest,
  deps: OrchestrateDeps,
  user?: { displayName: string },
  stored?: ConciergeLiveContext,
): Promise<ConciergeChatResponse> {
  const context = mergeContext(request, user, stored);
  const intent = classifyIntent(request.message, request.categoryHint);
  const { articles, citations } = retrieveAndRank(request.message, intent, context);
  const conversationId = request.conversationId?.trim() || randomUUID();

  const base = composeRetrieveReply(intent, context, articles);

  let mode: ConciergeMode = 'retrieve_and_rank';
  let fallbackReason: ConciergeChatResponse['fallbackReason'];
  let reply = base;

  const canLlm =
    deps.useLlm &&
    deps.llm &&
    !cannedEscalation(intent.escalationLevel);

  if (canLlm && deps.llm) {
    try {
      const userPrompt = [
        contextBlock(context),
        '',
        groundingBlock(articles),
        '',
        `Intent category: ${intent.category}`,
        `Escalation: ${intent.escalationLevel}`,
        `Allowed follow-up chips: ${uniqueStrings(articles.flatMap((article) => article.followUpChips ?? [])).join(' | ') || 'none'}`,
        '',
        userTurnBlock(request.message, request.history ?? []),
      ].join('\n');

      const raw = await deps.llm.complete({ system: SYSTEM_PROMPT, user: userPrompt });
      const parsed = parseLlmJson(raw);
      const allowed = allowedChipSet(articles);
      const llmChips = parsed.followUpChips.filter((chip) => allowed.has(chip.toLowerCase()));
      mode = 'llm';
      reply = {
        ...base,
        text: parsed.text,
        followUpChips: collectChips(articles, llmChips, context.tripMode),
        placeCards: base.placeCards,
        phraseTips: base.phraseTips,
      };
    } catch {
      fallbackReason = 'llm_error';
      mode = 'retrieve_and_rank';
      reply = base;
    }
  }

  if (cannedEscalation(intent.escalationLevel)) {
    reply = base;
    mode = 'retrieve_and_rank';
  }

  const sosCitations =
    intent.escalationLevel === 'sos'
      ? citations.filter((row) => row.articleId === 'my-faq-emergency').slice(0, 1)
      : citations;

  return {
    conversationId,
    category: intent.category,
    escalationLevel: intent.escalationLevel,
    mode,
    fallbackReason,
    reply,
    citations: sosCitations,
    analytics: {
      category: intent.category,
      escalationLevel: intent.escalationLevel,
    },
  };
}
