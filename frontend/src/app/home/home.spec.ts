import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { firstName, Home, selamatGreeting, tripDayNumber } from './home';

describe('home helpers', () => {
  it('greets in Malay by time of day', () => {
    expect(selamatGreeting(new Date(2026, 8, 20, 8))).toBe('Selamat Pagi');
    expect(selamatGreeting(new Date(2026, 8, 20, 15))).toBe('Selamat Petang');
    expect(selamatGreeting(new Date(2026, 8, 20, 21))).toBe('Selamat Malam');
  });

  it('uses the first name and clamps the trip day', () => {
    expect(firstName('Alex Tan')).toBe('Alex');
    expect(firstName('')).toBe('traveler');
    expect(tripDayNumber('2026-09-20', '2026-09-21', 7)).toBe(2);
  });
});

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-checklist`)
      .flush({
        airportCode: 'KUL',
        stage: null,
        stages: [],
        items: [],
      });
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/places/nearby`)
      .flush({
        provider: 'seed',
        fallback: false,
        origin: { latitude: 3.15, longitude: 101.71 },
        areaId: 'klcc',
        areaLabel: 'KLCC Precinct',
        radiusMeters: 2000,
        category: 'all',
        q: null,
        quickFilters: [],
        chips: [],
        counts: {},
        places: [],
      });
    http
      .expectOne(`${environment.apiBaseUrl}/auth/me`)
      .flush({ error: 'unauthenticated' }, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${environment.apiBaseUrl}/partners`).flush({ partners: [] });
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the Tropical Sanctuary home dashboard', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Selamat');
    expect(compiled.textContent).toContain('Welcome to Malaysia');
    expect(compiled.textContent).toContain('Explore Nearby');
    expect(compiled.textContent).toContain("Today's Plan");
    expect(compiled.querySelector('.account-links a[href="/arrival"]')?.textContent).toContain(
      'Arrival checklist',
    );
    expect(compiled.querySelector('.account-links a[href="/arrival/sim"]')?.textContent).toContain(
      'SIM',
    );
    expect(
      compiled.querySelector('.account-links a[href="/arrival/money"]')?.textContent,
    ).toContain('Currency');
    expect(compiled.querySelector('.account-links a[href="/safety"]')?.textContent).toContain(
      'Safety',
    );
    expect(compiled.querySelector('a.quick-card[href="/emergency"]')?.textContent).toContain(
      'Emergency',
    );
  });
});
