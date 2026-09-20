import type { FastifyRequest } from 'fastify';
import type { AuditActorType, AuditStore, RecordAuditInput } from './types.js';

export type AuditRecordInput = Omit<
  RecordAuditInput,
  'actorType' | 'actorUserId' | 'actorEmail' | 'requestId'
>;

export function actorFromRequest(request: FastifyRequest): {
  actorType: AuditActorType;
  actorUserId: string | null;
  actorEmail: string | null;
} {
  if (request.user) {
    return {
      actorType: 'admin_jwt',
      actorUserId: request.user.id,
      actorEmail: request.user.email,
    };
  }
  return {
    actorType: 'admin_token',
    actorUserId: null,
    actorEmail: null,
  };
}

export async function recordAdminAudit(
  request: FastifyRequest,
  resolveStore: () => AuditStore | undefined,
  input: AuditRecordInput,
): Promise<void> {
  const store = resolveStore();
  if (!store) return;
  const actor = actorFromRequest(request);
  try {
    await store.record({
      ...input,
      ...actor,
      requestId: String(request.id),
    });
  } catch (error) {
    request.log.error({ err: error, requestId: request.id }, 'Failed to record admin audit event');
  }
}
