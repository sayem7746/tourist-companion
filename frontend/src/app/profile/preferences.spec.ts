import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { Preferences } from './preferences';

const profile = {
  userId: 'user-1',
  email: 'sam@example.com',
  displayName: 'Sam',
  language: 'en',
  dietaryPreferences: ['halal'] as const,
  mobilityNeeds: [] as const,
  travelStyle: 'relaxed' as const,
};

const trip = {
  id: 'trip-1',
  userId: 'user-1',
  destination: 'Penang',
  startDate: '2026-10-01',
  endDate: '2026-10-08',
  adultCount: 2,
  childCount: 0,
  interests: ['food'],
  dailyBudget: 'medium' as const,
  travelStyle: 'relaxed' as const,
};

describe('Preferences', () => {
  let fixture: ComponentFixture<Preferences>;
  let component: Preferences;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Preferences],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Preferences);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('should load profile and trips', () => {
    http.expectOne(`${environment.apiBaseUrl}/profile`).flush({ profile });
    http.expectOne(`${environment.apiBaseUrl}/trips`).flush({ trips: [trip] });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Preferences');
    expect(component.displayName).toBe('Sam');
    expect(component.dietaryPreferences).toEqual(['halal']);
    expect(component.selectedTripId).toBe('trip-1');
    expect(component.interests).toEqual(['food']);
  });

  it('should PATCH profile and trip interests', () => {
    http.expectOne(`${environment.apiBaseUrl}/profile`).flush({ profile });
    http.expectOne(`${environment.apiBaseUrl}/trips`).flush({ trips: [trip] });

    component.toggleDietary('vegetarian');
    component.toggleInterest('culture');
    component.language = 'ms';
    component.dailyBudget = 'high';
    component.save();

    const profileReq = http.expectOne(`${environment.apiBaseUrl}/profile`);
    expect(profileReq.request.method).toBe('PATCH');
    expect(profileReq.request.withCredentials).toBeTrue();
    expect(profileReq.request.body).toEqual({
      displayName: 'Sam',
      language: 'ms',
      dietaryPreferences: ['halal', 'vegetarian'],
      mobilityNeeds: [],
      travelStyle: 'relaxed',
    });
    profileReq.flush({
      profile: { ...profile, language: 'ms', dietaryPreferences: ['halal', 'vegetarian'] },
    });

    const tripReq = http.expectOne(`${environment.apiBaseUrl}/trips/trip-1`);
    expect(tripReq.request.method).toBe('PATCH');
    expect(tripReq.request.body).toEqual({
      interests: ['food', 'culture'],
      dailyBudget: 'high',
      travelStyle: 'relaxed',
    });
    tripReq.flush({
      trip: { ...trip, interests: ['food', 'culture'], dailyBudget: 'high' },
    });
    fixture.detectChanges();
    expect(component.saved()).toBeTrue();
  });

  it('should save profile only when there is no trip', () => {
    http.expectOne(`${environment.apiBaseUrl}/profile`).flush({ profile });
    http.expectOne(`${environment.apiBaseUrl}/trips`).flush({ trips: [] });

    component.save();
    const profileReq = http.expectOne(`${environment.apiBaseUrl}/profile`);
    expect(profileReq.request.method).toBe('PATCH');
    profileReq.flush({ profile });
    http.expectNone(`${environment.apiBaseUrl}/trips/trip-1`);
    expect(component.saved()).toBeTrue();
  });

  it('should reject an invalid language tag', () => {
    http.expectOne(`${environment.apiBaseUrl}/profile`).flush({ profile });
    http.expectOne(`${environment.apiBaseUrl}/trips`).flush({ trips: [] });
    component.language = 'english';
    component.save();
    http.expectNone(`${environment.apiBaseUrl}/profile`);
    expect(component.saveError()).toContain('language tag');
  });
});
