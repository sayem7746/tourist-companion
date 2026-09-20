import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { ArrivalConnectivity } from './arrival-connectivity';
import type { ArrivalConnectivityResponse } from './arrival.service';

function guide(): ArrivalConnectivityResponse {
  return {
    airportCode: 'KUL',
    options: [
      {
        id: 'kul-wifi',
        airportCode: 'KUL',
        kind: 'wifi',
        name: 'Airport Wi-Fi',
        badge: 'Free 3 hours',
        summary: 'Use free terminal Wi-Fi',
        location: 'AIRPORT@WIFI in the arrival hall',
        cost: 'Free for 3 hours',
        howTo: 'Connect to AIRPORT@WIFI after you land.',
        whenToUse: 'Use Wi-Fi first if you have no data yet.',
        sortOrder: 1,
      },
      {
        id: 'kul-esim',
        airportCode: 'KUL',
        kind: 'esim',
        name: 'eSIM before you fly',
        badge: 'Skip the queue',
        summary: 'Install before you leave home',
        location: 'Install over home Wi-Fi',
        howTo: 'Scan the QR code on an unlocked phone.',
        whenToUse: 'Best if you want data the moment you land.',
        sortOrder: 2,
      },
      {
        id: 'kul-celcomdigi',
        airportCode: 'KUL',
        kind: 'prepaid_sim',
        name: 'CelcomDigi',
        badge: 'Tourist pack',
        summary: 'Prepaid SIM after customs',
        location: 'Public arrivals hall after customs',
        cost: '~RM 30',
        dataAllowance: '40GB 5G',
        howTo: 'Hand over your passport at the branded desk.',
        whenToUse: 'Choose this when you need more gigabytes for maps.',
        sortOrder: 3,
      },
    ],
    tips: [
      {
        id: 'kul-tip-passport',
        airportCode: 'KUL',
        title: 'Passport is required',
        body: 'Malaysia registers prepaid SIMs to your passport.',
        sortOrder: 1,
      },
    ],
  };
}

function flushPartners(http: HttpTestingController, partners: unknown[] = []): void {
  const req = http.expectOne(`${environment.apiBaseUrl}/partners`);
  expect(req.request.method).toBe('GET');
  req.flush({ partners });
}

describe('ArrivalConnectivity', () => {
  let fixture: ComponentFixture<ArrivalConnectivity>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArrivalConnectivity],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ArrivalConnectivity);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads GET /arrival-connectivity and explains Wi-Fi, eSIM, and SIM packs', () => {
    fixture.detectChanges();
    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-connectivity`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('airport')).toBe('KUL');
    req.flush(guide());
    flushPartners(http);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(text).toContain('Airport Wi-Fi');
    expect(text).toContain('AIRPORT@WIFI');
    expect(text).toContain('eSIM before you fly');
    expect(text).toContain('CelcomDigi');
    expect(text).toContain('Passport is required');
    expect(host.querySelector('.tip-card')).toBeTruthy();
  });

  it('filters by airport', () => {
    fixture.detectChanges();
    http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-connectivity`).flush(guide());
    flushPartners(http);
    fixture.detectChanges();

    fixture.componentInstance.onAirportChange('KLIA2');
    const next = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-connectivity`);
    expect(next.request.params.get('airport')).toBe('KLIA2');
    next.flush({
      airportCode: 'KLIA2',
      options: [
        {
          ...guide().options[0],
          id: 'klia2-wifi',
          airportCode: 'KLIA2',
          location: 'Gateway@klia2 — AIRPORT@WIFI',
        },
      ],
      tips: [
        {
          id: 'klia2-tip-terminal',
          airportCode: 'KLIA2',
          title: 'KLIA2 is not main KLIA',
          body: 'Set Grab to KLIA2.',
          sortOrder: 1,
        },
      ],
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Gateway@klia2 — AIRPORT@WIFI');
  });

  it('shows an error when the guide fails to load', () => {
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-connectivity`)
      .flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    flushPartners(http);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not load the SIM and connectivity guide');
  });
});
