export const CONCIERGE_HISTORY_ROLES = ['user', 'assistant'] as const;
export type ConciergeHistoryRole = (typeof CONCIERGE_HISTORY_ROLES)[number];

export const CHAT_CONTEXT_HISTORY_MAX = 10;

export interface ConciergeStoredMessage {
  id: string;
  userId: string;
  tripId: string;
  conversationId: string;
  role: ConciergeHistoryRole;
  content: string;
  createdAt: string;
  expiresAt: string;
}

export interface ConciergeHistoryTurn {
  role: ConciergeHistoryRole;
  content: string;
}

export interface ConciergeRetention {
  maxMessages: number;
  ttlMs: number;
  persistEmergency: false;
}

export interface ConciergeHistoryView {
  tripId: string | null;
  conversationId: string | null;
  messages: Array<{
    role: ConciergeHistoryRole;
    content: string;
    createdAt: string;
    expiresAt: string;
  }>;
  retention: ConciergeRetention;
}

export interface AppendHistoryInput {
  userId: string;
  tripId: string;
  conversationId: string;
  turns: ConciergeHistoryTurn[];
  maxMessages: number;
  ttlMs: number;
  now?: Date;
}

export interface ConciergeHistoryStore {
  list(userId: string, tripId: string, now?: Date): Promise<ConciergeStoredMessage[]>;
  append(input: AppendHistoryInput): Promise<ConciergeStoredMessage[]>;
  deleteForTrip(userId: string, tripId: string): Promise<number>;
}

export function historyRetention(maxMessages: number, ttlMs: number): ConciergeRetention {
  return { maxMessages, ttlMs, persistEmergency: false };
}

export function shouldPersistHistory(escalationLevel: string): boolean {
  return escalationLevel !== 'sos';
}

export function toHistoryTurns(messages: ConciergeStoredMessage[]): ConciergeHistoryTurn[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

export function contextHistory(messages: ConciergeStoredMessage[]): ConciergeHistoryTurn[] {
  return toHistoryTurns(messages).slice(-CHAT_CONTEXT_HISTORY_MAX);
}

export function publicHistoryMessages(
  messages: ConciergeStoredMessage[],
): ConciergeHistoryView['messages'] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    expiresAt: message.expiresAt,
  }));
}
