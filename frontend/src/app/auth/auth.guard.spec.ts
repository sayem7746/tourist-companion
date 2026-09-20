import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
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

  it('allows a signed-in tourist', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/trips' } as never),
    );
    let allowed: unknown;
    (result as { subscribe: (next: (value: unknown) => void) => void }).subscribe((value) => {
      allowed = value;
    });
    const req = http.expectOne(`${environment.apiBaseUrl}/auth/me`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({
      user: { id: '1', email: 'ada@example.com', displayName: 'Ada', role: 'tourist' },
    });
    expect(allowed).toBe(true);
  });

  it('redirects anonymous users to /login with returnUrl', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/trips/new' } as never),
    );
    let tree: unknown;
    (result as { subscribe: (next: (value: unknown) => void) => void }).subscribe((value) => {
      tree = value;
    });
    http
      .expectOne(`${environment.apiBaseUrl}/auth/me`)
      .flush({ error: { message: 'Unauthorized' } }, { status: 401, statusText: 'Unauthorized' });
    expect(router.serializeUrl(tree as ReturnType<Router['createUrlTree']>)).toBe(
      '/login?returnUrl=%2Ftrips%2Fnew',
    );
  });
});
