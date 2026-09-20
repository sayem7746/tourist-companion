import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createMemoryAuditStore } from '../src/audit/memory-store.js';
import { isAuditAction, isAuditEntityType, type AuditEvent } from '../src/audit/types.js';
import { hashPassword } from '../src/auth/password.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { loadConfig } from '../src/config.js';

const ADMIN_TOKEN = 'test-only-admin-token';
const config = loadConfig({
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3000',
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'test-only-insecure-jwt-secret',
  ADMIN_TOKEN,
  CONCIERGE_RATE_LIMIT_MAX: '200',
});
const app = buildApp(config);
const adminHeaders = { 'x-admin-token': ADMIN_TOKEN };

type AuditBody = {
  action: string | null;
  entityType: string | null;
  entityId: string | null;
  limit: number;
  offset: number;
  total: number;
  events: AuditEvent[];
};

describe('audit model', () => {
  it('accepts the admin mutation actions and entity types', () => {
    expect(isAuditAction('partner.create')).toBe(true);
    expect(isAuditAction('partner.approve')).toBe(true);
    expect(isAuditAction('content.publish')).toBe(true);
    expect(isAuditAction('faq.unpublish')).toBe(true);
    expect(isAuditAction('partner.list')).toBe(false);
    expect(isAuditEntityType('partner')).toBe(true);
    expect(isAuditEntityType('content')).toBe(true);
    expect(isAuditEntityType('faq')).toBe(true);
    expect(isAuditEntityType('trip')).toBe(false);
  });

  it('lists newest first and filters by action and entity', async () => {
    const store = createMemoryAuditStore();
    const partner = await store.record({
      action: 'partner.create',
      entityType: 'partner',
      entityId: '11111111-1111-4111-8111-111111111111',
      summary: 'Created partner Grab',
      actorType: 'admin_token',
    });
    const published = await store.record({
      action: 'content.publish',
      entityType: 'content',
      entityId: '22222222-2222-4222-8222-222222222222',
      summary: 'Published content Guide',
      actorType: 'admin_jwt',
      actorEmail: 'ops@example.com',
    });

    const all = await store.list();
    expect(all.total).toBe(2);
    expect(all.events.map((event) => event.id)).toEqual([published.id, partner.id]);

    const filtered = await store.list({ action: 'partner.create', entityType: 'partner' });
    expect(filtered.total).toBe(1);
    expect(filtered.events[0]?.id).toBe(partner.id);

    const paged = await store.list({ limit: 1, offset: 1 });
    expect(paged.total).toBe(2);
    expect(paged.events[0]?.id).toBe(partner.id);
  });
});

describe('GET /admin/audit', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function readAudit(query = ''): Promise<AuditBody> {
    const listed = await app.inject({
      method: 'GET',
      url: `/admin/audit${query}`,
      headers: adminHeaders,
    });
    expect(listed.statusCode).toBe(200);
    return listed.json() as AuditBody;
  }

  it('rejects anonymous and tourist sessions', async () => {
    const missing = await app.inject({ method: 'GET', url: '/admin/audit' });
    expect(missing.statusCode).toBe(401);

    const tourist = signAccessToken(
      {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'ada@example.com',
        displayName: 'Ada',
        role: 'tourist',
      },
      config,
    );
    const forbidden = await app.inject({
      method: 'GET',
      url: '/admin/audit',
      headers: { authorization: `Bearer ${tourist}` },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('records partner CRUD, approve, and pause without logging reads or failed writes', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/admin/partners',
      headers: adminHeaders,
      payload: {
        name: 'Audit Grab',
        category: 'transfers',
        listing: { summary: 'Airport rides for audit tests.' },
      },
    });
    expect(created.statusCode).toBe(201);
    const partnerId = (created.json() as { partner: { id: string } }).partner.id;

    const listedPartners = await app.inject({
      method: 'GET',
      url: '/admin/partners',
      headers: adminHeaders,
    });
    expect(listedPartners.statusCode).toBe(200);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/admin/partners',
      headers: adminHeaders,
      payload: { name: 'Other', slug: 'audit-grab', category: 'sim' },
    });
    expect(duplicate.statusCode).toBe(409);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/admin/partners/${partnerId}`,
      headers: adminHeaders,
      payload: { name: 'Audit Grab KL' },
    });
    expect(updated.statusCode).toBe(200);

    const approved = await app.inject({
      method: 'POST',
      url: `/admin/partners/${partnerId}/approve`,
      headers: adminHeaders,
    });
    expect(approved.statusCode).toBe(200);

    const paused = await app.inject({
      method: 'POST',
      url: `/admin/partners/${partnerId}/pause`,
      headers: adminHeaders,
    });
    expect(paused.statusCode).toBe(200);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/admin/partners/${partnerId}`,
      headers: adminHeaders,
    });
    expect(removed.statusCode).toBe(204);

    const body = await readAudit(`?entityType=partner&entityId=${partnerId}`);
    expect(body.total).toBe(5);
    expect(body.events.map((event) => event.action)).toEqual([
      'partner.delete',
      'partner.pause',
      'partner.approve',
      'partner.update',
      'partner.create',
    ]);
    expect(body.events.every((event) => event.actorType === 'admin_token')).toBe(true);
    expect(body.events[0]?.summary).toContain('Audit Grab KL');
    expect(body.events[4]?.metadata).toMatchObject({
      name: 'Audit Grab',
      slug: 'audit-grab',
      category: 'transfers',
      isActive: false,
    });
  });

  it('records content and FAQ publish changes', async () => {
    const content = await app.inject({
      method: 'POST',
      url: '/admin/content',
      headers: adminHeaders,
      payload: {
        kind: 'etiquette',
        title: 'Mosque dress code',
        body: 'Cover shoulders and knees before entering a mosque.',
      },
    });
    expect(content.statusCode).toBe(201);
    const contentId = (content.json() as { item: { id: string } }).item.id;

    const publishedContent = await app.inject({
      method: 'POST',
      url: `/admin/content/${contentId}/publish`,
      headers: adminHeaders,
    });
    expect(publishedContent.statusCode).toBe(200);

    const unpublishedContent = await app.inject({
      method: 'POST',
      url: `/admin/content/${contentId}/unpublish`,
      headers: adminHeaders,
    });
    expect(unpublishedContent.statusCode).toBe(200);

    const faq = await app.inject({
      method: 'POST',
      url: '/admin/faqs',
      headers: adminHeaders,
      payload: {
        title: 'Can I tap cards on the train?',
        body: 'Yes on Rapid KL gates; keep a small cash backup.',
        topic: 'money_payments',
      },
    });
    expect(faq.statusCode).toBe(201);
    const faqId = (faq.json() as { item: { id: string } }).item.id;

    const publishedFaq = await app.inject({
      method: 'POST',
      url: `/admin/faqs/${faqId}/publish`,
      headers: adminHeaders,
    });
    expect(publishedFaq.statusCode).toBe(200);

    const unpublishedFaq = await app.inject({
      method: 'POST',
      url: `/admin/faqs/${faqId}/unpublish`,
      headers: adminHeaders,
    });
    expect(unpublishedFaq.statusCode).toBe(200);

    const contentLog = await readAudit(`?entityType=content&entityId=${contentId}`);
    expect(contentLog.events.map((event) => event.action)).toEqual([
      'content.unpublish',
      'content.publish',
    ]);

    const faqLog = await readAudit(`?action=faq.publish`);
    expect(faqLog.events.some((event) => event.entityId === faqId)).toBe(true);
    expect(faqLog.events.every((event) => event.action === 'faq.publish')).toBe(true);
  });

  it('attributes JWT admin actors and still accepts ADMIN_TOKEN for the list', async () => {
    const isolated = buildApp(config);
    await isolated.ready();
    try {
      const store = isolated.getAuthStore();
      expect(store).toBeDefined();
      const passwordHash = await hashPassword('password12', 'test');
      await store!.createUser({
        email: 'ops-audit@example.com',
        displayName: 'Ops Audit',
        passwordHash,
        role: 'admin',
      });

      const adminLogin = await isolated.inject({
        method: 'POST',
        url: '/auth/admin/login',
        payload: { email: 'ops-audit@example.com', password: 'password12' },
      });
      expect(adminLogin.statusCode).toBe(200);
      const { token, user } = adminLogin.json() as {
        token: string;
        user: { id: string; email: string };
      };

      const created = await isolated.inject({
        method: 'POST',
        url: '/admin/partners',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'JWT Audit Transfer',
          category: 'transfers',
          listing: { summary: 'Signed-in admin create.' },
        },
      });
      expect(created.statusCode).toBe(201);

      const viaJwt = await isolated.inject({
        method: 'GET',
        url: '/admin/audit?action=partner.create',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(viaJwt.statusCode).toBe(200);
      const jwtBody = viaJwt.json() as AuditBody;
      expect(jwtBody.events[0]).toMatchObject({
        action: 'partner.create',
        actorType: 'admin_jwt',
        actorUserId: user.id,
        actorEmail: 'ops-audit@example.com',
        summary: 'Created partner JWT Audit Transfer',
      });
      expect(jwtBody.events[0]?.requestId).toBeTruthy();

      const viaHeader = await isolated.inject({
        method: 'GET',
        url: '/admin/audit?limit=1',
        headers: { 'x-admin-token': ADMIN_TOKEN },
      });
      expect(viaHeader.statusCode).toBe(200);
      const headerBody = viaHeader.json() as AuditBody;
      expect(headerBody.limit).toBe(1);
      expect(headerBody.events).toHaveLength(1);
    } finally {
      await isolated.close();
    }
  });
});
