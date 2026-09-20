import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { safeReturnUrl } from './auth.service';
import { Login } from './login';

describe('safeReturnUrl', () => {
  it('keeps in-app paths and rejects open redirects', () => {
    expect(safeReturnUrl('/trips/new')).toBe('/trips/new');
    expect(safeReturnUrl('/trips')).toBe('/trips');
    expect(safeReturnUrl(null)).toBe('/');
    expect(safeReturnUrl('')).toBe('/');
    expect(safeReturnUrl('https://evil.example')).toBe('/');
    expect(safeReturnUrl('//evil.example')).toBe('/');
  });
});

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let http: HttpTestingController;
  let router: Router;

  async function setup(returnUrl?: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
  });

  it('should render the sign-in form', async () => {
    await setup();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Sign in');
    expect(compiled.querySelector('button')?.textContent).toContain('Sign in');
    expect(compiled.querySelector('a[href="/signup"]')?.textContent).toContain('Create one');
    expect(compiled.querySelector('a[href="/privacy"]')?.textContent).toContain('Privacy');
    expect(compiled.querySelector('a[href="/terms"]')?.textContent).toContain('Terms');
  });

  it('should post credentials to /auth/login', async () => {
    await setup();
    component.email = 'ada@example.com';
    component.password = 'password12';
    component.submit();

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({ email: 'ada@example.com', password: 'password12' });
    req.flush({
      user: { id: '1', email: 'ada@example.com', displayName: 'Ada', role: 'tourist' },
      token: 'jwt',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('should honor returnUrl after a successful login', async () => {
    await setup('/trips/new');
    component.email = 'ada@example.com';
    component.password = 'password12';
    component.submit();

    http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      user: { id: '1', email: 'ada@example.com', displayName: 'Ada', role: 'tourist' },
      token: 'jwt',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/trips/new');
  });

  it('should ignore an off-site returnUrl', async () => {
    await setup('https://evil.example');
    component.email = 'ada@example.com';
    component.password = 'password12';
    component.submit();

    http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      user: { id: '1', email: 'ada@example.com', displayName: 'Ada', role: 'tourist' },
      token: 'jwt',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('should show an error when login fails', async () => {
    await setup();
    component.email = 'ada@example.com';
    component.password = 'wrong-password';
    component.submit();

    http
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush(
        { error: { message: 'Invalid email or password' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    fixture.detectChanges();
    expect(component.error()).toBe('Invalid email or password.');
    expect((fixture.nativeElement as HTMLElement).querySelector('.error')?.textContent).toContain(
      'Invalid email or password',
    );
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
