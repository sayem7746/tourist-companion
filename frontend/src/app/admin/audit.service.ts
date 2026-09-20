import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

export type AuditActorType = 'admin_jwt' | 'admin_token';
export type AuditEntityFilter = AuditEntityType | 'all';

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'partner.create': 'Created partner',
  'partner.update': 'Updated partner',
  'partner.delete': 'Deleted partner',
  'partner.approve': 'Approved partner',
  'partner.pause': 'Paused partner',
  'content.publish': 'Published content',
  'content.unpublish': 'Unpublished content',
  'faq.publish': 'Published FAQ',
  'faq.unpublish': 'Unpublished FAQ',
};

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  partner: 'Partner',
  content: 'Content',
  faq: 'FAQ',
};

export const AUDIT_ENTITY_CHIPS: Array<{ id: AuditEntityFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'partner', label: 'Partners' },
  { id: 'content', label: 'Content' },
  { id: 'faq', label: 'FAQs' },
];

export interface AuditEvent {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  metadata: Record<string, unknown>;
  actorType: AuditActorType;
  actorUserId: string | null;
  actorEmail: string | null;
  requestId: string;
  createdAt: string;
}

export interface AuditList {
  action: AuditAction | null;
  entityType: AuditEntityType | null;
  entityId: string | null;
  limit: number;
  offset: number;
  total: number;
  events: AuditEvent[];
}

export function auditListParams(
  entityType: AuditEntityFilter = 'all',
  limit = 50,
): HttpParams {
  let params = new HttpParams();
  if (entityType !== 'all') {
    params = params.set('entityType', entityType);
  }
  if (limit !== 50) {
    params = params.set('limit', String(limit));
  }
  return params;
}

export function auditActionLabel(action: AuditAction): string {
  return AUDIT_ACTION_LABELS[action];
}

export function auditActorLabel(event: Pick<AuditEvent, 'actorType' | 'actorEmail'>): string {
  if (event.actorType === 'admin_jwt' && event.actorEmail) {
    return event.actorEmail;
  }
  return 'Admin token';
}

export function formatAuditTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')} UTC`;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/audit`;

  list(entityType: AuditEntityFilter = 'all'): Observable<AuditList> {
    return this.http.get<AuditList>(this.url, {
      params: auditListParams(entityType),
      withCredentials: true,
    });
  }
}
