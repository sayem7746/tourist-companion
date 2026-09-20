import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminLogin, adminLoginError } from './admin-login';
import { HttpErrorResponse } from '@angular/common/http';

describe('AdminLogin', () => {
  let fixture: ComponentFixture<AdminLogin>;
  let component: AdminLogin;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLogin],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLogin);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('should render the admin sign-in form', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Admin sign in');
    expect(compiled.querySelector('button')?.textContent).toContain('Sign in');
  });

  it('should post credentials to /auth/admin/login', () => {
    component.email = 'ops@example.com';
    component.password = 'password12';
    component.submit();

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/admin/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({ email: 'ops@example.com', password: 'password12' });
    req.flush({
      user: { id: '1', email: 'ops@example.com', displayName: 'Ops', role: 'admin' },
      token: 'jwt',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('should reject a tourist account', () => {
    component.email = 'ada@example.com';
    component.password = 'password12';
    component.submit();
    const req = http.expectOne(`${environment.apiBaseUrl}/auth/admin/login`);
    req.flush(
      { error: { message: 'Administrator access required' } },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(component.error()).toContain('not an administrator');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('maps HTTP errors for the form', () => {
    expect(
      adminLoginError(new HttpErrorResponse({ status: 403, statusText: 'Forbidden' })),
    ).toContain('not an administrator');
    expect(
      adminLoginError(new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' })),
    ).toContain('Invalid email or password');
  });
});
