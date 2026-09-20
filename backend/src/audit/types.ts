export const AUDIT_ACTIONS = [
  'partner.create',
  'partner.update',
  'partner.delete',
  'partner.approve',
  'partner.pause',
  'content.publish',
  'content.unpublish',
  'faq.publish',
  'faq.unpublish',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_TYPES = ['partner', 'content', 'faq'] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTOR_TYPES = ['admin_jwt', 'admin_token'] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export type AuditMetadata = Record<string, unknown>;

export interface AuditEvent {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  metadata: AuditMetadata;
  actorType: AuditActorType;
  actorUserId: string | null;
  actorEmail: string | null;
  requestId: string;
  createdAt: string;
}

export interface RecordAuditInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  metadata?: AuditMetadata;
  actorType: AuditActorType;
  actorUserId?: string | null;
  actorEmail?: string | null;
  requestId?: string;
}

export interface AuditListFilters {
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditListResult {
  events: AuditEvent[];
  total: number;
}

export interface AuditStore {
  record(input: RecordAuditInput): Promise<AuditEvent>;
  list(filters?: AuditListFilters): Promise<AuditListResult>;
}

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === 'string' && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export function isAuditEntityType(value: unknown): value is AuditEntityType {
  return typeof value === 'string' && (AUDIT_ENTITY_TYPES as readonly string[]).includes(value);
}
