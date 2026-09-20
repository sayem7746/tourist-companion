import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { adminGuard, safeAdminReturnUrl } from './admin.guard';

describe('adminGuard', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
  });

  it('keeps admin return URLs on the ops surface', () => {
    expect(safeAdminReturnUrl('/admin')).toBe('/admin');
    expect(safeAdminReturnUrl('/admin/login')).toBe('/admin/login');
    expect(safeAdminReturnUrl('/trips')).toBe('/admin');
    expect(safeAdminReturnUrl('https://evil.example')).toBe('/admin');
  });

  it('allows an admin session and redirects everyone else', () => {
    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as never, { url: '/admin' } as never),
    );
    let allowed: unknown;
    (result as { subscribe: (next: (value: unknown) => void) => void }).subscribe((value) => {
      allowed = value;
    });
    http.expectOne(`${environment.apiBaseUrl}/auth/me`).flush({
      user: { id: '1', email: 'ops@example.com', displayName: 'Ops', role: 'admin' },
    });
    expect(allowed).toBe(true);

    const touristResult = TestBed.runInInjectionContext(() =>
      adminGuard({} as never, { url: '/admin' } as never),
    );
    let tourist: unknown;
    (touristResult as { subscribe: (next: (value: unknown) => void) => void }).subscribe(
      (value) => {
        tourist = value;
      },
    );
    http.expectOne(`${environment.apiBaseUrl}/auth/me`).flush({
      user: { id: '2', email: 'ada@example.com', displayName: 'Ada', role: 'tourist' },
    });
    expect(router.serializeUrl(tourist as ReturnType<Router['createUrlTree']>)).toContain(
      '/admin/login',
    );
  });
});
