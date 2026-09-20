import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminHome } from './admin';
import { dashboardCards, type OpsDashboard } from './dashboard.service';

const adminUser = {
  id: '1',
  email: 'ops@example.com',
  displayName: 'Ops',
  role: 'admin' as const,
};

const dashboard: OpsDashboard = {
  users: 4,
  trips: 2,
  conciergeUsage: 9,
  nearbySearches: 6,
  referrals: 3,
  errors: 1,
  sources: {
    users: 'store',
    trips: 'store',
    conciergeUsage: 'metrics',
    nearbySearches: 'metrics',
    referrals: 'store',
    errors: 'metrics',
  },
};

describe('dashboard helpers', () => {
  it('builds operational cards and flags errors', () => {
    const cards = dashboardCards(dashboard);
    expect(cards.map((card) => card.label)).toEqual([
      'Users',
      'Trips',
      'Concierge',
      'Nearby',
      'Referrals',
      'Errors',
    ]);
    expect(cards.find((card) => card.key === 'users')?.value).toBe(4);
    expect(cards.find((card) => card.key === 'errors')?.alert).toBeTrue();
    expect(
      dashboardCards({ ...dashboard, errors: 0 }).find((card) => card.key === 'errors')?.alert,
    ).toBeFalse();
  });
});

describe('AdminHome', () => {
  let fixture: ComponentFixture<AdminHome>;
  let component: AdminHome;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminHome],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminHome);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  function flushSession(): void {
    http.expectOne(`${environment.apiBaseUrl}/auth/me`).flush({ user: adminUser });
    fixture.detectChanges();
  }

  function flushDashboard(body: OpsDashboard = dashboard): void {
    const req = http.expectOne(`${environment.apiBaseUrl}/admin/dashboard`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ dashboard: body });
    fixture.detectChanges();
  }

  it('should show the signed-in administrator and operational counts', () => {
    flushSession();
    flushDashboard();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Operations');
    expect(compiled.textContent).toContain('ops@example.com');
    expect(compiled.textContent).toContain('admin');
    expect(compiled.textContent).toContain('Manage content');
    expect(compiled.textContent).toContain('Manage FAQs');
    expect(compiled.textContent).toContain('Manage partners');
    expect(compiled.textContent).toContain('Audit log');
    expect(compiled.querySelector('a[href="/admin/content"]')).toBeTruthy();
    expect(compiled.querySelector('a[href="/admin/faqs"]')).toBeTruthy();
    expect(compiled.querySelector('a[href="/admin/partners"]')).toBeTruthy();
    expect(compiled.querySelector('a[href="/admin/audit"]')).toBeTruthy();
    expect(compiled.querySelector('[aria-label="Operational counts"]')).toBeTruthy();
    expect(compiled.textContent).toContain('Users');
    expect(compiled.textContent).toContain('Trips');
    expect(compiled.textContent).toContain('Concierge');
    expect(compiled.textContent).toContain('Nearby');
    expect(compiled.textContent).toContain('Referrals');
    expect(compiled.textContent).toContain('Errors');
    expect(compiled.textContent).toContain('4');
    expect(compiled.textContent).toContain('9');
    expect(compiled.querySelector('.stat-alert')).toBeTruthy();
  });

  it('should keep the home page usable if counts fail to load', () => {
    flushSession();
    const req = http.expectOne(`${environment.apiBaseUrl}/admin/dashboard`);
    req.flush(
      { error: { message: 'Administrator authentication required' } },
      {
        status: 401,
        statusText: 'Unauthorized',
      },
    );
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Could not load operational counts.');
    expect(compiled.textContent).toContain('Manage partners');
    expect(compiled.querySelector('[aria-label="Operational counts"]')).toBeFalsy();
  });

  it('should sign out and return to admin login', () => {
    flushSession();
    flushDashboard();
    component.logout();
    const req = http.expectOne(`${environment.apiBaseUrl}/auth/logout`);
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/login');
  });
});
