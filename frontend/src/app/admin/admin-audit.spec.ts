import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminAudit } from './admin-audit';
import {
  auditActionLabel,
  auditActorLabel,
  auditListParams,
  formatAuditTime,
  type AuditEvent,
} from './audit.service';

const created: AuditEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  action: 'partner.create',
  entityType: 'partner',
  entityId: '22222222-2222-4222-8222-222222222222',
  summary: 'Created partner Audit Grab',
  metadata: { name: 'Audit Grab', slug: 'audit-grab' },
  actorType: 'admin_jwt',
  actorUserId: '33333333-3333-4333-8333-333333333333',
  actorEmail: 'ops@example.com',
  requestId: 'req-1',
  createdAt: '2026-09-20T10:15:00.000Z',
};

const published: AuditEvent = {
  id: '44444444-4444-4444-8444-444444444444',
  action: 'faq.publish',
  entityType: 'faq',
  entityId: '55555555-5555-4555-8555-555555555555',
  summary: 'Published FAQ Train cards',
  metadata: { title: 'Train cards' },
  actorType: 'admin_token',
  actorUserId: null,
  actorEmail: null,
  requestId: 'req-2',
  createdAt: '2026-09-20T11:00:00.000Z',
};

describe('audit helpers', () => {
  it('builds list filters and labels actors', () => {
    expect(auditListParams().keys()).toEqual([]);
    expect(auditListParams('faq').get('entityType')).toBe('faq');
    expect(auditActionLabel('partner.approve')).toBe('Approved partner');
    expect(auditActorLabel(created)).toBe('ops@example.com');
    expect(auditActorLabel(published)).toBe('Admin token');
    expect(formatAuditTime(created.createdAt)).toBe('2026-09-20 10:15:00 UTC');
  });
});

describe('AdminAudit', () => {
  let fixture: ComponentFixture<AdminAudit>;
  let component: AdminAudit;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAudit],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAudit);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('lists audit events and filters by entity', () => {
    const req = http.expectOne(`${environment.apiBaseUrl}/admin/audit`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ events: [published, created], total: 2 });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Audit log');
    expect(compiled.textContent).toContain('Created partner Audit Grab');
    expect(compiled.textContent).toContain('Published FAQ Train cards');
    expect(compiled.textContent).toContain('ops@example.com');
    expect(compiled.textContent).toContain('Admin token');
    expect(compiled.textContent).toContain('2 recorded changes');

    component.filterEntity('partner');
    const filtered = http.expectOne(`${environment.apiBaseUrl}/admin/audit?entityType=partner`);
    filtered.flush({ entityType: 'partner', events: [created], total: 1 });
    fixture.detectChanges();
    expect(component.events()).toEqual([created]);
  });

  it('shows an empty state and recovers from load errors', () => {
    http.expectOne(`${environment.apiBaseUrl}/admin/audit`).flush(
      { error: { message: 'Administrator authentication required' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Could not load the audit log.');

    component.load();
    http.expectOne(`${environment.apiBaseUrl}/admin/audit`).flush({ events: [], total: 0 });
    fixture.detectChanges();
    expect(compiled.textContent).toContain('No audit events match these filters.');
  });
});
