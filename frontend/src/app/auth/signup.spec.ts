import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { Signup } from './signup';

describe('Signup', () => {
  let fixture: ComponentFixture<Signup>;
  let component: Signup;
  let http: HttpTestingController;
  let router: Router;

  async function setup(returnUrl?: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Signup],
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

    fixture = TestBed.createComponent(Signup);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
  });

  it('should render the sign-up form', async () => {
    await setup();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Create account');
    expect(compiled.querySelector('button')?.textContent).toContain('Sign up');
    expect(compiled.querySelector('a[href="/login"]')?.textContent).toContain('Sign in');
  });

  it('should post credentials to /auth/signup', async () => {
    await setup();
    component.displayName = 'Ada';
    component.email = 'ada@example.com';
    component.password = 'password12';
    component.submit();

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/signup`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({
      displayName: 'Ada',
      email: 'ada@example.com',
      password: 'password12',
    });
    req.flush({
      user: { id: '1', email: 'ada@example.com', displayName: 'Ada', role: 'tourist' },
      token: 'jwt',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('should honor returnUrl after a successful signup', async () => {
    await setup('/trips/new');
    component.displayName = 'Ada';
    component.email = 'ada@example.com';
    component.password = 'password12';
    component.submit();

    http.expectOne(`${environment.apiBaseUrl}/auth/signup`).flush({
      user: { id: '1', email: 'ada@example.com', displayName: 'Ada', role: 'tourist' },
      token: 'jwt',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/trips/new');
  });

  it('should show an error when signup fails', async () => {
    await setup();
    component.displayName = 'Ada';
    component.email = 'taken@example.com';
    component.password = 'password12';
    component.submit();

    http
      .expectOne(`${environment.apiBaseUrl}/auth/signup`)
      .flush(
        { error: { message: 'Email already registered' } },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();
    expect(component.error()).toContain('Could not create that account');
    expect((fixture.nativeElement as HTMLElement).querySelector('.error')?.textContent).toContain(
      'Try a different email',
    );
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
