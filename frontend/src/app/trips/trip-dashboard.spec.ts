import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import {
  buildTimeline,
  formatTime12h,
  highlightCount,
  inclusiveDayCount,
  itineraryIsEmpty,
  localTodayIso,
  selectFeaturedTrip,
  selectPlanDayNumber,
  TripDashboard,
} from './trip-dashboard';
import type { Itinerary, ItineraryItem, Trip } from './trip.service';

function trip(partial: Partial<Trip> & Pick<Trip, 'id' | 'startDate' | 'endDate'>): Trip {
  return {
    userId: 'user-1',
    destination: 'Penang',
    adultCount: 2,
    childCount: 0,
    interests: ['food'],
    dailyBudget: 'medium',
    travelStyle: 'balanced',
    ...partial,
  };
}

function item(partial: Partial<ItineraryItem> & Pick<ItineraryItem, 'id' | 'kind' | 'startTime' | 'endTime'>): ItineraryItem {
  return {
    dayId: 'day-2',
    sortOrder: 0,
    placeId: null,
    travelTimeMinutes: null,
    notes: null,
    bookingUrl: null,
    referralPartnerId: null,
    locked: false,
    title: null,
    ...partial,
  };
}

function skeleton(tripId: string, dayCount = 7): Itinerary {
  return {
    id: 'itin-1',
    tripId,
    dayCount,
    status: 'draft',
    generatedAt: null,
    days: Array.from({ length: dayCount }, (_, index) => ({
      id: `day-${index + 1}`,
      itineraryId: 'itin-1',
      dayNumber: index + 1,
      date: `2099-01-${String(10 + index).padStart(2, '0')}`,
      items: [],
    })),
  };
}

function filledPlan(tripId: string): Itinerary {
  const base = skeleton(tripId, 7);
  base.days[1] = {
    ...base.days[1],
    date: '2026-09-22',
    items: [],
  };
  base.days[0] = {
    ...base.days[0],
    items: [
      item({
        id: 'a1',
        kind: 'activity',
        startTime: '09:30',
        endTime: '11:00',
        title: 'Petronas Twin Towers',
        placeId: 'my-attr-petronas',
        bookingUrl: 'https://www.petronastwintowers.com.my/',
        notes: 'Book the skybridge slot',
      }),
      item({
        id: 'm1',
        kind: 'meal',
        startTime: '12:00',
        endTime: '13:00',
        title: 'Madam Kwan’s',
        placeId: 'my-food-madam-kwan',
        travelTimeMinutes: 15,
      }),
      item({
        id: 'n1',
        kind: 'note',
        startTime: '14:00',
        endTime: '15:00',
        title: 'Rest at the hotel',
        notes: 'Open afternoon for downtime',
      }),
    ],
  };
  return base;
}

describe('trip dashboard helpers', () => {
  it('counts inclusive calendar days', () => {
    expect(inclusiveDayCount('2026-11-01', '2026-11-05')).toBe(5);
  });

  it('prefers a current trip over later ones', () => {
    const today = '2026-11-03';
    const featured = selectFeaturedTrip(
      [
        trip({ id: 'later', startDate: '2026-12-01', endDate: '2026-12-04' }),
        trip({ id: 'now', startDate: '2026-11-01', endDate: '2026-11-05' }),
      ],
      today,
    );
    expect(featured?.id).toBe('now');
  });

  it('picks the nearest upcoming trip when none are current', () => {
    const featured = selectFeaturedTrip(
      [
        trip({ id: 'far', startDate: '2026-12-10', endDate: '2026-12-14' }),
        trip({ id: 'soon', startDate: '2026-12-01', endDate: '2026-12-04' }),
      ],
      '2026-11-01',
    );
    expect(featured?.id).toBe('soon');
  });

  it('formats 24h times as 12h Stitch clocks', () => {
    expect(formatTime12h('09:30')).toBe('09:30 AM');
    expect(formatTime12h('16:00')).toBe('04:00 PM');
  });

  it('counts activity and meal highlights', () => {
    const plan = filledPlan('trip-1');
    expect(highlightCount(plan.days[0])).toBe(2);
    expect(itineraryIsEmpty(skeleton('trip-1'))).toBeTrue();
    expect(itineraryIsEmpty(plan)).toBeFalse();
  });

  it('selects today’s day number when it is on the plan', () => {
    expect(selectPlanDayNumber(filledPlan('trip-1'), '2026-09-22')).toBe(2);
    expect(selectPlanDayNumber(filledPlan('trip-1'), '2020-01-01')).toBe(1);
  });

  it('inserts commute connectors from inbound minutes and travel blocks', () => {
    const rows = buildTimeline([
      item({ id: 't1', kind: 'travel', startTime: '08:00', endTime: '08:50', title: 'Transfer from KUL', travelTimeMinutes: 50 }),
      item({ id: 'a1', kind: 'activity', startTime: '09:30', endTime: '11:00', title: 'Petronas Twin Towers' }),
      item({
        id: 'm1',
        kind: 'meal',
        startTime: '12:00',
        endTime: '13:00',
        title: 'Madam Kwan’s',
        travelTimeMinutes: 15,
      }),
    ]);
    expect(rows[0]).toEqual(
      jasmine.objectContaining({ type: 'commute', minutes: 50, title: 'Transfer from KUL' }),
    );
    expect(rows[1]).toEqual(jasmine.objectContaining({ type: 'block' }));
    expect(rows[2]).toEqual(jasmine.objectContaining({ type: 'commute', minutes: 15 }));
    expect(rows[3]).toEqual(jasmine.objectContaining({ type: 'block' }));
  });
});

describe('TripDashboard', () => {
  let fixture: ComponentFixture<TripDashboard>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripDashboard],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TripDashboard);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads GET /trips with credentials and generates an empty itinerary', () => {
    fixture.detectChanges();
    const req = http.expectOne(`${environment.apiBaseUrl}/trips`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();

    const start = '2099-01-10';
    const end = '2099-01-14';
    req.flush({
      trips: [
        trip({
          id: 'trip-1',
          destination: 'Langkawi',
          startDate: start,
          endDate: end,
          interests: ['nature', 'wellness'],
        }),
      ],
    });
    const placesReq = http.expectOne(`${environment.apiBaseUrl}/trips/trip-1/places`);
    expect(placesReq.request.method).toBe('GET');
    expect(placesReq.request.withCredentials).toBeTrue();
    placesReq.flush({
      places: [
        {
          tripId: 'trip-1',
          placeId: 'my-food-madam-kwan',
          catalogId: 'cat-1',
          name: 'Madam Kwan’s (Suria KLCC)',
          category: 'food' as const,
          city: 'Kuala Lumpur',
          address: null,
          latitude: 3.15,
          longitude: 101.71,
          notes: null,
          sortOrder: 0,
        },
      ],
    });
    const itinReq = http.expectOne(`${environment.apiBaseUrl}/trips/trip-1/itinerary`);
    expect(itinReq.request.method).toBe('GET');
    expect(itinReq.request.withCredentials).toBeTrue();
    itinReq.flush({ itinerary: skeleton('trip-1', 5) });

    const generateReq = http.expectOne(`${environment.apiBaseUrl}/trips/trip-1/itinerary/generate`);
    expect(generateReq.request.method).toBe('POST');
    expect(generateReq.request.withCredentials).toBeTrue();
    generateReq.flush({ itinerary: filledPlan('trip-1') });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Plan');
    expect(compiled.textContent).toContain('Day 1 of 7');
    expect(compiled.textContent).toContain('Langkawi');
    expect(compiled.textContent).toContain('5 days');
    expect(compiled.textContent).toContain("Today's Plan");
    expect(compiled.textContent).toContain('09:30 AM');
    expect(compiled.textContent).toContain('Petronas Twin Towers');
    expect(compiled.querySelector('a[href="/explore/my-attr-petronas"]')?.textContent).toContain('Petronas Twin Towers');
    expect(compiled.querySelector('a[href="https://www.petronastwintowers.com.my/"]')?.textContent).toContain('Tickets');
    expect(compiled.textContent).toContain('15 min travel time');
    expect(compiled.textContent).toContain('Directions');
    expect(compiled.textContent).toContain('Meal');
    expect(compiled.textContent).toContain("Madam Kwan’s");
    expect(compiled.textContent).toContain('Open afternoon for downtime');
    expect(compiled.textContent).toContain('Madam Kwan’s (Suria KLCC)');
    expect(compiled.querySelector('.saved-list a[href="/explore/my-food-madam-kwan"]')?.textContent).toContain(
      'Madam Kwan’s (Suria KLCC)',
    );
    expect(compiled.textContent).toContain('Partner referrals will appear');
    expect(compiled.querySelector('a[href="/trips/new"]')?.textContent).toContain('Plan a trip');
    expect(compiled.querySelector('a[href="/arrival"]')?.textContent).toContain('Arrival checklist');
    expect(localTodayIso().length).toBe(10);
  });

  it('does not generate when the itinerary already has stops', () => {
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/trips`).flush({
      trips: [trip({ id: 'trip-2', destination: 'Kuala Lumpur', startDate: '2099-02-01', endDate: '2099-02-07' })],
    });
    http.expectOne(`${environment.apiBaseUrl}/trips/trip-2/places`).flush({ places: [] });
    http.expectOne(`${environment.apiBaseUrl}/trips/trip-2/itinerary`).flush({ itinerary: filledPlan('trip-2') });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Petronas Twin Towers');
    http.verify();
  });

  it('shows an empty state when there is no current or upcoming trip', () => {
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/trips`).flush({ trips: [] });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No current or upcoming trip yet');
    expect(compiled.querySelector('a[routerLink="/trips/new"], a[href="/trips/new"]')).toBeTruthy();
  });

  it('shows an error when GET /trips fails', () => {
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/trips`).flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Could not load your trips');
  });
});
