import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { Emergency } from './emergency';
import {
  EMERGENCY_CONTEXT_AREA,
  EMERGENCY_LEDE,
  SOS_COLOR,
  SOS_PATH,
  emergencyHttpParams,
  numberDisplay,
  telHref,
  type EmergencyDirectory,
} from './emergency.service';

function directory(partial: Partial<EmergencyDirectory> = {}): EmergencyDirectory {
  return {
    country: 'MY',
    destination: 'Malaysia',
    version: '2026-09-mvp',
    category: null,
    urgency: null,
    categories: ['police', 'ambulance', 'fire', 'tourist_assistance'],
    disclaimer:
      'If you are in immediate danger, call 999 or 112 now. This directory is not a substitute for emergency services.',
    sos: {
      color: '#E11D48',
      path: 'emergency-help',
      numbers: [
        { code: '999', label: 'Police, fire, ambulance' },
        { code: '112', label: 'Mobile networks' },
      ],
    },
    contacts: [
      {
        id: 'my-em-police',
        name: 'Police (MERS 999)',
        category: 'police',
        urgency: 'sos',
        numbers: [
          { code: '999', label: 'Police' },
          { code: '112', label: 'Mobile networks' },
        ],
        summary: 'Royal Malaysia Police via the nationwide MERS 999 emergency line.',
        whenToUse: 'Call now for crime in progress, assault, or any threat to life or property.',
        area: 'Nationwide',
        hours: '24/7',
        englishSpoken: true,
        source: 'Malaysian Emergency Response Services (MERS 999)',
        sourceUrl: 'https://999.gov.my/',
        sortOrder: 1,
      },
      {
        id: 'my-em-tourist-police',
        name: 'Tourist Police (Bukit Bintang)',
        category: 'tourist_assistance',
        urgency: 'assistance',
        numbers: [{ code: '+60321496590', display: '03-2149 6590', label: 'Hotline' }],
        summary: 'Kuala Lumpur Tourist Police for visitor help in tourist areas.',
        whenToUse: 'Use for lost property, scams, or directions in Bukit Bintang.',
        area: 'Kuala Lumpur',
        hours: 'Hotline; use 999 after hours if you are in danger',
        englishSpoken: true,
        source: 'Kuala Lumpur Tourist Police',
        sortOrder: 4,
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

function normalizedColor(value: string): string {
  const hex = value.trim().toLowerCase();
  if (hex === '#e11d48') {
    return 'rgb(225, 29, 72)';
  }
  return value.replace(/\s+/g, ' ').trim();
}

describe('emergency helpers', () => {
  it('builds tel: links and query params', () => {
    expect(telHref('999')).toBe('tel:999');
    expect(telHref('+60321496590')).toBe('tel:+60321496590');
    expect(numberDisplay({ code: '+60321496590', display: '03-2149 6590' })).toBe('03-2149 6590');
    expect(emergencyHttpParams('all').keys()).toEqual([]);
    expect(emergencyHttpParams('sos').get('urgency')).toBe('sos');
    expect(emergencyHttpParams('police').get('category')).toBe('police');
  });
});

describe('Emergency', () => {
  let fixture: ComponentFixture<Emergency>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Emergency],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Emergency);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads GET /emergency with SOS #E11D48, tel: links, and location guidance', () => {
    fixture.detectChanges();
    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/emergency`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(directory());
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(host.querySelector('h1')?.textContent).toContain('Emergency help');
    expect(text).toContain(EMERGENCY_LEDE);
    expect(text).toContain('Share your location');
    expect(text).toContain(EMERGENCY_CONTEXT_AREA);
    expect(text).toContain('international visitor in Malaysia');
    expect(text).toContain('Police (MERS 999)');
    expect(text).toContain('Tourist Police (Bukit Bintang)');
    expect(text).toContain('English spoken');
    expect(text).toContain('When to use');
    expect(SOS_COLOR).toBe('#E11D48');
    expect(SOS_PATH).toBe('emergency-help');

    const hero = host.querySelector('#emergency-help') as HTMLElement;
    expect(hero.getAttribute('data-path')).toBe('emergency-help');
    expect(normalizedColor(hero.style.background)).toBe('rgb(225, 29, 72)');
    expect(host.querySelector('a[href="tel:999"]')?.textContent).toContain('999');
    expect(host.querySelector('a[href="tel:112"]')?.textContent).toContain('112');
    expect(host.querySelector('a[href="tel:+60321496590"]')?.textContent).toContain('03-2149 6590');
  });

  it('filters the directory by urgency and category', () => {
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/emergency`)
      .flush(directory());
    fixture.detectChanges();

    const sosChip = chipByLabel(fixture.nativeElement as HTMLElement, 'SOS');
    sosChip.click();
    const sosReq = http.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/emergency`,
    );
    expect(sosReq.request.params.get('urgency')).toBe('sos');
    sosReq.flush(
      directory({
        urgency: 'sos',
        contacts: [directory().contacts[0]!],
      }),
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Police (MERS 999)');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Tourist Police (Bukit Bintang)',
    );

    const touristChip = chipByLabel(fixture.nativeElement as HTMLElement, 'Tourist help');
    touristChip.click();
    const touristReq = http.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/emergency`,
    );
    expect(touristReq.request.params.get('category')).toBe('tourist_assistance');
    touristReq.flush(
      directory({
        category: 'tourist_assistance',
        contacts: [directory().contacts[1]!],
      }),
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Tourist Police (Bukit Bintang)',
    );
  });

  it('shows an error when the directory fails to load', () => {
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/emergency`)
      .flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Could not load emergency help',
    );
    expect(fixture.nativeElement.querySelector('a[href="tel:999"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="tel:112"]')).toBeTruthy();
  });
});
