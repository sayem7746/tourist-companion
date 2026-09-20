import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { ArrivalTransport } from './arrival-transport';
import type { ArrivalTransportResponse } from './arrival.service';

function guide(): ArrivalTransportResponse {
  return {
    airportCode: 'KUL',
    options: [
      {
        id: 'kul-opt-ekspres',
        airportCode: 'KUL',
        mode: 'ekspres',
        name: 'KLIA Ekspres',
        badge: 'Fastest',
        summary: 'Direct non-stop high-speed train',
        cost: '~RM 55 per adult',
        duration: '28 mins',
        frequency: 'Every 15–20 min',
        destination: 'KL Sentral',
        bestFor: 'Solo travelers',
        boarding: 'Level 1',
        whenToUse: 'Choose this when you want to skip highway traffic.',
        sortOrder: 1,
      },
      {
        id: 'kul-opt-bus',
        airportCode: 'KUL',
        mode: 'bus',
        name: 'Airport bus',
        badge: 'Budget',
        summary: 'Aerobus coaches',
        cost: '~RM 12–15',
        duration: '60–75 mins',
        destination: 'KL Sentral',
        bestFor: 'Backpackers',
        boarding: 'Transportation hub',
        whenToUse: 'Use buses when cost matters more than speed.',
        sortOrder: 2,
      },
      {
        id: 'kul-opt-e-hail',
        airportCode: 'KUL',
        mode: 'e_hail',
        name: 'Grab / taxi',
        badge: 'Door-to-door',
        summary: 'Official e-hailing',
        cost: '~RM 65–85',
        duration: '50–65 mins',
        destination: 'Direct Hotel',
        bestFor: 'Families',
        boarding: 'Level 1 Door 3',
        whenToUse: 'Best when you need a hotel drop-off.',
        sortOrder: 3,
      },
      {
        id: 'kul-opt-private',
        airportCode: 'KUL',
        mode: 'private',
        name: 'Private transfer',
        badge: 'Meet & greet',
        summary: 'Pre-booked car',
        cost: 'Higher fixed quote',
        duration: '50–70 mins',
        destination: 'Direct to hotel',
        bestFor: 'Late flights',
        boarding: 'Arrivals meeting point',
        whenToUse: 'Book ahead when you land late or have mobility needs.',
        sortOrder: 4,
      },
    ],
  };
}

function flushPartners(http: HttpTestingController, partners: unknown[] = []): void {
  const req = http.expectOne(`${environment.apiBaseUrl}/partners`);
  expect(req.request.method).toBe('GET');
  req.flush({ partners });
}

describe('ArrivalTransport', () => {
  let fixture: ComponentFixture<ArrivalTransport>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArrivalTransport],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ArrivalTransport);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads GET /arrival-transport and explains each option', () => {
    fixture.detectChanges();
    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-transport`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('airport')).toBe('KUL');
    req.flush(guide());
    flushPartners(http);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('KLIA Ekspres');
    expect(text).toContain('Airport bus');
    expect(text).toContain('Grab / taxi');
    expect(text).toContain('Private transfer');
    expect(text).toContain('skip highway traffic');
    expect(text).toContain('cost matters more than speed');
    expect(text).toContain('hotel drop-off');
    expect(text).toContain('mobility needs');
    expect(text).toContain('Hotel transfer helper');
  });

  it('filters by airport', () => {
    fixture.detectChanges();
    http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-transport`).flush(guide());
    flushPartners(http);
    fixture.detectChanges();

    fixture.componentInstance.onAirportChange('KLIA2');
    const next = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-transport`);
    expect(next.request.params.get('airport')).toBe('KLIA2');
    next.flush({
      airportCode: 'KLIA2',
      options: [
        {
          ...guide().options[0],
          id: 'klia2-opt-ekspres',
          airportCode: 'KLIA2',
          boarding: 'Gateway@klia2 Level 2',
        },
      ],
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Gateway@klia2 Level 2');
  });

  it('shows an error when the guide fails to load', () => {
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-transport`)
      .flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    flushPartners(http);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not load the airport transport guide');
  });
});
