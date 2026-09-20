import { fakeAsync, tick, ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { Embassies } from './embassies';
import {
  EMBASSY_LEDE,
  embassyHttpParams,
  officialWebsiteHref,
  type EmbassyDirectory,
} from './embassy.service';

function directory(partial: Partial<EmbassyDirectory> = {}): EmbassyDirectory {
  return {
    country: 'MY',
    destination: 'Malaysia',
    version: '2026-09-mvp',
    q: null,
    kind: null,
    kinds: ['embassy', 'high_commission', 'consulate'],
    disclaimer:
      'This is a seed of major foreign missions in Kuala Lumpur. Contact links are official mission websites only.',
    missions: [
      {
        id: 'kl-mission-us',
        name: 'U.S. Embassy in Malaysia',
        sendingCountry: 'United States',
        sendingCountryCode: 'US',
        kind: 'embassy',
        city: 'Kuala Lumpur',
        area: 'Kuala Lumpur',
        address: '376 Jalan Tun Razak, 50400 Kuala Lumpur',
        officialWebsite: 'https://my.usembassy.gov/',
        summary: 'U.S. Embassy in Kuala Lumpur for consular assistance to U.S. nationals.',
        whenToUse: 'Use after a police report for a lost or stolen passport.',
        hours: 'Confirm consular hours on the official website.',
        tags: ['united states', 'usa', 'embassy'],
        source: 'U.S. Embassy in Malaysia',
        sourceUrl: 'https://my.usembassy.gov/',
        sortOrder: 17,
      },
      {
        id: 'kl-mission-gb',
        name: 'British High Commission',
        sendingCountry: 'United Kingdom',
        sendingCountryCode: 'GB',
        kind: 'high_commission',
        city: 'Kuala Lumpur',
        area: 'Kuala Lumpur',
        officialWebsite:
          'https://www.gov.uk/world/organisations/british-high-commission-kuala-lumpur',
        summary:
          'British High Commission in Kuala Lumpur for consular assistance to British nationals.',
        whenToUse: 'Use after a police report for a lost or stolen passport.',
        hours: 'Confirm consular hours on the official website.',
        tags: ['uk', 'britain', 'high commission'],
        source: 'British High Commission Kuala Lumpur',
        sourceUrl: 'https://www.gov.uk/world/organisations/british-high-commission-kuala-lumpur',
        sortOrder: 16,
      },
    ],
    ...partial,
  };
}

function chipByLabel(host: HTMLElement, label: string): HTMLButtonElement {
  const match = Array.from(host.querySelectorAll<HTMLButtonElement>('.chip-row .chip')).find(
    (el) => el.textContent?.trim() === label,
  );
  expect(match).toBeTruthy();
  return match!;
}

describe('embassy helpers', () => {
  it('builds search params and https-only website hrefs', () => {
    expect(embassyHttpParams().keys()).toEqual([]);
    expect(embassyHttpParams('u').keys()).toEqual([]);
    expect(embassyHttpParams('united states').get('q')).toBe('united states');
    expect(embassyHttpParams('', 'embassy').get('kind')).toBe('embassy');
    expect(officialWebsiteHref('https://my.usembassy.gov/')).toBe('https://my.usembassy.gov/');
    expect(officialWebsiteHref('http://my.usembassy.gov/')).toBe('');
    expect(officialWebsiteHref('https://en.wikipedia.org/wiki/Embassy')).toBe('');
  });
});

describe('Embassies', () => {
  let fixture: ComponentFixture<Embassies>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Embassies],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Embassies);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads GET /embassies with official website links only', () => {
    fixture.detectChanges();
    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/embassies`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(directory());
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(host.querySelector('h1')?.textContent).toContain('Embassies and consulates');
    expect(text).toContain(EMBASSY_LEDE);
    expect(text).toContain('Official websites only');
    expect(text).toContain('U.S. Embassy in Malaysia');
    expect(text).toContain('British High Commission');
    expect(text).toContain('376 Jalan Tun Razak');
    expect(host.querySelector('a[href="/emergency"]')?.textContent).toContain('emergency help');
    expect(host.querySelector('a[href="https://my.usembassy.gov/"]')?.textContent).toContain(
      'Official website',
    );
    expect(host.querySelector('a[href="http://my.usembassy.gov/"]')).toBeNull();
    expect(
      host.querySelector(
        'a[href="https://www.gov.uk/world/organisations/british-high-commission-kuala-lumpur"]',
      ),
    ).toBeTruthy();
  });

  it('debounces search into GET /embassies?q=', fakeAsync(() => {
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/embassies`)
      .flush(directory());
    fixture.detectChanges();

    fixture.componentInstance.onSearchInput('singapore');
    tick(250);
    const searchReq = http.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/embassies`,
    );
    expect(searchReq.request.params.get('q')).toBe('singapore');
    searchReq.flush(
      directory({
        q: 'singapore',
        missions: [
          {
            ...directory().missions[0]!,
            id: 'kl-mission-sg',
            name: 'High Commission of the Republic of Singapore',
            sendingCountry: 'Singapore',
            sendingCountryCode: 'SG',
            kind: 'high_commission',
            officialWebsite: 'https://kl.mfa.gov.sg/',
            sourceUrl: 'https://kl.mfa.gov.sg/',
            source: 'High Commission of the Republic of Singapore in Kuala Lumpur',
          },
        ],
      }),
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'High Commission of the Republic of Singapore',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'U.S. Embassy in Malaysia',
    );
  }));

  it('filters by mission kind', () => {
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/embassies`)
      .flush(directory());
    fixture.detectChanges();

    chipByLabel(fixture.nativeElement as HTMLElement, 'High commission').click();
    const kindReq = http.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/embassies`,
    );
    expect(kindReq.request.params.get('kind')).toBe('high_commission');
    kindReq.flush(
      directory({
        kind: 'high_commission',
        missions: [directory().missions[1]!],
      }),
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('British High Commission');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'U.S. Embassy in Malaysia',
    );
  });

  it('shows an error when the directory fails to load', () => {
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/embassies`)
      .flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Could not load the embassy directory',
    );
  });
});
