import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { firstName, Home, selamatGreeting, tripDayNumber } from './home';
import { localTodayIso } from '../trips/trip.service';

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

describe('Home signed-in dashboard', () => {
  let fixture: ComponentFixture<Home>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-checklist`)
      .flush({
        airportCode: 'KUL',
        stage: null,
        stages: [],
        items: [
          {
            id: 'kul-immigration-mdac',
            airportCode: 'KUL',
            stage: 'immigration',
            title: 'Complete MDAC before passport control',
            body: 'Do this after landing.',
            sortOrder: 1,
            estimatedMinutes: 10,
          },
        ],
      });
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/places/nearby`)
      .flush({
        provider: 'seed',
        fallback: false,
        origin: { latitude: 3.15, longitude: 101.71 },
        areaId: 'klcc',
        areaLabel: 'KLCC & Downtown',
        radiusMeters: 2000,
        category: 'all',
        q: null,
        quickFilters: [],
        chips: [],
        counts: {},
        places: [
          {
            id: 'my-food-madam-kwan',
            name: 'Madam Kwan’s (Suria KLCC)',
            category: 'food',
            nearbyCategory: 'food',
            city: 'Kuala Lumpur',
            country: 'MY',
            area: 'KLCC',
            address: 'Suria KLCC',
            description: 'Malaysian classics.',
            latitude: 3.15795,
            longitude: 101.71205,
            distanceMeters: 450,
            walkMinutes: 6,
            openNow: true,
            badges: ['Halal'],
            source: 'seed',
          },
        ],
      });
    const me = http.expectOne(`${environment.apiBaseUrl}/auth/me`);
    expect(me.request.withCredentials).toBeTrue();
    me.flush({
      user: { id: 'user-1', email: 'ada@example.com', displayName: 'Ada Tan', role: 'tourist' },
    });
    http.expectOne(`${environment.apiBaseUrl}/partners`).flush({ partners: [] });

    const today = localTodayIso();
    const trips = http.expectOne(`${environment.apiBaseUrl}/trips`);
    expect(trips.request.withCredentials).toBeTrue();
    trips.flush({
      trips: [
        {
          id: 'trip-1',
          userId: 'user-1',
          destination: 'Penang',
          startDate: today,
          endDate: today,
          adultCount: 2,
          childCount: 0,
          interests: ['food'],
          dailyBudget: 'medium',
          travelStyle: 'balanced',
        },
      ],
    });
    const itinerary = http.expectOne(`${environment.apiBaseUrl}/trips/trip-1/itinerary`);
    expect(itinerary.request.withCredentials).toBeTrue();
    itinerary.flush({
      itinerary: {
        id: 'itin-1',
        tripId: 'trip-1',
        dayCount: 1,
        status: 'draft',
        generatedAt: null,
        days: [
          {
            id: 'day-1',
            itineraryId: 'itin-1',
            dayNumber: 1,
            date: today,
            items: [
              {
                id: 'a1',
                dayId: 'day-1',
                sortOrder: 0,
                kind: 'activity',
                startTime: '09:30',
                endTime: '11:00',
                placeId: 'my-attr-petronas',
                travelTimeMinutes: null,
                notes: 'Book the skybridge slot',
                bookingUrl: 'https://www.petronastwintowers.com.my/',
                referralPartnerId: null,
                locked: false,
                title: 'Petronas Twin Towers',
              },
            ],
          },
        ],
      },
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the signed-in trip, itinerary, and nearby cards', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Ada');
    expect(compiled.textContent).toContain('Penang');
    expect(compiled.textContent).toContain('Day 1 of 1');
    expect(compiled.textContent).toContain('Petronas Twin Towers');
    expect(compiled.textContent).toContain('Book the skybridge slot');
    expect(compiled.querySelector('a[href="/explore/my-attr-petronas"]')?.textContent).toContain(
      'Petronas Twin Towers',
    );
    expect(compiled.textContent).toContain('Madam Kwan’s (Suria KLCC)');
    expect(compiled.textContent).toContain('Immigration & Passport Control');
    expect(compiled.querySelector('a.quick-card[href="/emergency"]')?.textContent).toContain(
      'Emergency',
    );
  });
});
