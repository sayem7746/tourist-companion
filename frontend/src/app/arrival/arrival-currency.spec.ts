import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { ArrivalCurrency } from './arrival-currency';
import type { ArrivalCurrencyResponse } from './arrival.service';

function guide(): ArrivalCurrencyResponse {
  return {
    airportCode: 'KUL',
    options: [
      {
        id: 'kul-ringgit',
        airportCode: 'KUL',
        kind: 'ringgit',
        name: 'Malaysian Ringgit',
        badge: 'MYR',
        summary: 'Malaysia’s currency is the ringgit',
        currencyCode: 'MYR',
        howTo: 'Read prices as RM. The ISO ticker is MYR.',
        whenToUse: 'Use this as the mental model for every ATM.',
        sortOrder: 1,
      },
      {
        id: 'kul-atm',
        airportCode: 'KUL',
        kind: 'atm',
        name: 'Airport ATMs',
        badge: 'ATM',
        summary: 'Bank ATMs after customs',
        location: 'KLIA (main) public arrivals concourse',
        currencyCode: 'MYR',
        howTo: 'Choose MYR with no conversion at a bank ATM.',
        whenToUse: 'Withdraw here if you need cash before leaving.',
        sortOrder: 2,
      },
      {
        id: 'kul-card',
        airportCode: 'KUL',
        kind: 'card',
        name: 'Cards and contactless',
        badge: 'CARDS',
        summary: 'Visa and Mastercard work in malls',
        currencyCode: 'MYR',
        howTo: 'Pay contactless in MYR and decline home-currency conversion.',
        whenToUse: 'Default to cards in hotels and malls.',
        sortOrder: 3,
      },
    ],
    tips: [
      {
        id: 'kul-tip-dcc',
        airportCode: 'KUL',
        title: 'Decline DCC — pay in MYR',
        body: 'Choose MYR on the terminal.',
        sortOrder: 1,
      },
    ],
  };
}

describe('ArrivalCurrency', () => {
  let fixture: ComponentFixture<ArrivalCurrency>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArrivalCurrency],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ArrivalCurrency);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads GET /arrival-currency and explains ringgit, ATMs, and cards', () => {
    fixture.detectChanges();
    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-currency`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('airport')).toBe('KUL');
    req.flush(guide());
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(text).toContain('Malaysian Ringgit');
    expect(text).toContain('MYR');
    expect(text).toContain('Airport ATMs');
    expect(text).toContain('Cards and contactless');
    expect(text).toContain('Decline DCC — pay in MYR');
    const labels = Array.from(host.querySelectorAll('.facts dt')).map((el) => el.textContent?.trim());
    expect(labels).toContain('MYR');
    expect(host.querySelector('.tip-card')).toBeTruthy();
  });

  it('filters by airport', () => {
    fixture.detectChanges();
    http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-currency`).flush(guide());
    fixture.detectChanges();

    fixture.componentInstance.onAirportChange('KLIA2');
    const next = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-currency`);
    expect(next.request.params.get('airport')).toBe('KLIA2');
    next.flush({
      airportCode: 'KLIA2',
      options: [
        {
          ...guide().options[1],
          id: 'klia2-atm',
          airportCode: 'KLIA2',
          location: 'Gateway@klia2 — bank ATMs',
        },
      ],
      tips: [
        {
          id: 'klia2-tip-atm',
          airportCode: 'KLIA2',
          title: 'Bank ATMs in Gateway',
          body: 'Stay inside Gateway@klia2.',
          sortOrder: 1,
        },
      ],
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Gateway@klia2 — bank ATMs');
  });

  it('shows an error when the guide fails to load', () => {
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-currency`)
      .flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Could not load the currency and payment guide',
    );
  });
});
