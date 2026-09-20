import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import {
  inclusiveDayCount,
  localTodayIso,
  selectFeaturedTrip,
  TripDashboard,
} from './trip-dashboard';
import type { Trip } from './trip.service';

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

  it('loads GET /trips with credentials and shows an upcoming trip', () => {
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
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Trip dashboard');
    expect(compiled.textContent).toContain('Upcoming trip');
    expect(compiled.textContent).toContain('Langkawi');
    expect(compiled.textContent).toContain('5 days');
    expect(compiled.textContent).toContain('Itinerary summary will appear');
    expect(compiled.textContent).toContain('Saved places will appear');
    expect(compiled.textContent).toContain('Partner referrals will appear');
    expect(compiled.querySelector('a[href="/trips/new"]')?.textContent).toContain('Plan a trip');
    expect(compiled.querySelector('a[href="/arrival"]')?.textContent).toContain('Arrival checklist');
    expect(localTodayIso().length).toBe(10);
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
