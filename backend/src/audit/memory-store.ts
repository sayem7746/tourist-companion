import { randomUUID } from 'node:crypto';
import type {
  AuditEvent,
  AuditListFilters,
  AuditListResult,
  AuditStore,
  RecordAuditInput,
} from './types.js';

const DEFAULT_LIMIT = 50;

function cloneEvent(event: AuditEvent): AuditEvent {
  return {
    ...event,
    metadata: { ...event.metadata },
  };
}

function matches(event: AuditEvent, filters?: AuditListFilters): boolean {
  if (filters?.action && event.action !== filters.action) return false;
  if (filters?.entityType && event.entityType !== filters.entityType) return false;
  if (filters?.entityId && event.entityId !== filters.entityId) return false;
  return true;
}

export function createMemoryAuditStore(seed: AuditEvent[] = []): AuditStore {
  const events: AuditEvent[] = seed.map(cloneEvent);

  return {
    async record(input: RecordAuditInput) {
      const event: AuditEvent = {
        id: randomUUID(),
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary.trim(),
        metadata: { ...(input.metadata ?? {}) },
        actorType: input.actorType,
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        requestId: input.requestId?.trim() || '',
        createdAt: new Date().toISOString(),
      };
      events.unshift(event);
      return cloneEvent(event);
    },
    async list(filters?: AuditListFilters): Promise<AuditListResult> {
      const matched = events.filter((event) => matches(event, filters)).map(cloneEvent);
      const offset = filters?.offset ?? 0;
      const limit = filters?.limit ?? DEFAULT_LIMIT;
      return {
        events: matched.slice(offset, offset + limit),
        total: matched.length,
      };
    },
  };
}
