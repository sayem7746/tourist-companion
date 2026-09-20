import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { TripOnboarding } from './trip-onboarding';

describe('TripOnboarding', () => {
  let fixture: ComponentFixture<TripOnboarding>;
  let component: TripOnboarding;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripOnboarding],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TripOnboarding);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('should render step 1 of 6', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Plan a trip');
    expect(compiled.querySelector('.progress')?.textContent).toContain('Step 1 of 6');
    expect(compiled.textContent).toContain('Kuala Lumpur');
  });

  it('should block next without a destination', () => {
    component.next();
    fixture.detectChanges();
    expect(component.step()).toBe(1);
    expect(component.fieldError()).toContain('destination');
  });

  it('should require departure after arrival', () => {
    component.destinationPreset = 'Penang';
    component.next();
    component.startDate = '2026-10-10';
    component.endDate = '2026-10-10';
    component.next();
    expect(component.step()).toBe(2);
    expect(component.fieldError()).toContain('Departure');
  });

  it('should require at least one interest', () => {
    component.destinationPreset = 'Langkawi';
    component.next();
    component.startDate = '2026-11-01';
    component.endDate = '2026-11-05';
    component.next();
    component.adultCount = 2;
    component.next();
    component.next();
    expect(component.step()).toBe(4);
    expect(component.fieldError()).toContain('interest');
  });

  it('should POST /trips with credentials after review', () => {
    component.destinationPreset = 'Other';
    component.customCity = 'Ipoh';
    component.next();
    component.startDate = '2026-12-01';
    component.endDate = '2026-12-08';
    component.next();
    component.adultCount = 1;
    component.childCount = 1;
    component.next();
    component.toggleInterest('food');
    component.toggleInterest('culture');
    component.next();
    component.dailyBudget = 'medium';
    component.travelStyle = 'relaxed';
    component.next();
    expect(component.step()).toBe(6);

    component.createTrip();
    const req = http.expectOne(`${environment.apiBaseUrl}/trips`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({
      destination: 'Ipoh',
      startDate: '2026-12-01',
      endDate: '2026-12-08',
      adultCount: 1,
      childCount: 1,
      interests: ['food', 'culture'],
      dailyBudget: 'medium',
      travelStyle: 'relaxed',
    });
    req.flush({
      trip: {
        id: 'trip-1',
        userId: 'user-1',
        destination: 'Ipoh',
        startDate: '2026-12-01',
        endDate: '2026-12-08',
        adultCount: 1,
        childCount: 1,
        interests: ['food', 'culture'],
        dailyBudget: 'medium',
        travelStyle: 'relaxed',
      },
    });
  });
});
