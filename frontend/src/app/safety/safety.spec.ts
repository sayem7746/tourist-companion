import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { Safety } from './safety';
import {
  isSafetyGuidePath,
  SAFETY_ACCENT,
  SAFETY_LEDE,
  safetyHttpParams,
  type SafetyGuide,
} from './safety.service';

function guide(partial: Partial<SafetyGuide> = {}): SafetyGuide {
  return {
    country: 'MY',
    destination: 'Malaysia',
    version: '2026-09-mvp',
    topic: null,
    topics: ['lost_items', 'scams', 'transport_disputes', 'document_loss'],
    disclaimer:
      'If you are in immediate danger, call 999 or 112 now. These tips are everyday guidance.',
    accent: '#0D7652',
    emergencyPath: '/emergency',
    embassyPath: '/embassies',
    tips: [
      {
        id: 'my-safety-lost-items',
        topic: 'lost_items',
        title: 'Lost phone, wallet, or bag',
        summary: 'Retrace your last stops, then file a police report if it is still missing.',
        steps: ['Retrace your last stops.', 'Ask the hotel desk.', 'File a police report.'],
        whenToUse: 'Use after a phone, wallet, or bag goes missing and you are not in danger.',
        icon: 'inventory_2',
        links: [{ label: 'Tourist Police and SOS', path: '/emergency' }],
        sortOrder: 1,
      },
      {
        id: 'my-safety-documents',
        topic: 'document_loss',
        title: 'Lost or stolen passport',
        summary: 'File a police report first, then open your embassy from the directory.',
        steps: ['File a police report first.', 'Open your embassy website.'],
        whenToUse: 'Use after a lost or stolen passport when you are safe.',
        icon: 'badge',
        links: [
          { label: 'Emergency help', path: '/emergency' },
          { label: 'Find your embassy', path: '/embassies' },
        ],
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
  if (hex === '#0d7652') {
    return 'rgb(13, 118, 82)';
  }
  return value.replace(/\s+/g, ' ').trim();
}

describe('safety helpers', () => {
  it('builds topic query params and allows embassy/emergency paths only', () => {
    expect(safetyHttpParams('all').keys()).toEqual([]);
    expect(safetyHttpParams('scams').get('topic')).toBe('scams');
    expect(isSafetyGuidePath('/emergency')).toBe(true);
    expect(isSafetyGuidePath('/embassies')).toBe(true);
    expect(isSafetyGuidePath('https://example.com')).toBe(false);
    expect(SAFETY_ACCENT).toBe('#0D7652');
  });
});

describe('Safety', () => {
  let fixture: ComponentFixture<Safety>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Safety],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Safety);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads GET /safety with emerald tip cards and embassy/emergency links', () => {
    fixture.detectChanges();
    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/safety`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(guide());
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(host.querySelector('h1')?.textContent).toContain('Safety tips');
    expect(text).toContain(SAFETY_LEDE);
    expect(text).toContain('Lost phone, wallet, or bag');
    expect(text).toContain('Lost or stolen passport');
    expect(text).toContain('When to use');
    expect(host.querySelectorAll('[data-accent="emerald"]').length).toBe(2);
    const card = host.querySelector('.emerald-tip') as HTMLElement;
    expect(normalizedColor(card.style.getPropertyValue('--tip-accent'))).toBe('rgb(13, 118, 82)');
    expect(host.querySelector('a[href="/emergency"]')?.textContent).toMatch(/SOS|Emergency/);
    expect(host.querySelector('a[href="/embassies"]')?.textContent).toContain('embassy');
  });

  it('filters the guide by topic', () => {
    fixture.detectChanges();
    http.expectOne((request) => request.url === `${environment.apiBaseUrl}/safety`).flush(guide());
    fixture.detectChanges();

    chipByLabel(fixture.nativeElement as HTMLElement, 'Documents').click();
    const topicReq = http.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/safety`,
    );
    expect(topicReq.request.params.get('topic')).toBe('document_loss');
    topicReq.flush(
      guide({
        topic: 'document_loss',
        tips: [guide().tips[1]!],
      }),
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Lost or stolen passport');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Lost phone, wallet, or bag',
    );
  });

  it('shows an error when the guide fails to load', () => {
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/safety`)
      .flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Could not load safety tips',
    );
    expect(fixture.nativeElement.querySelector('a[href="/emergency"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/embassies"]')).toBeTruthy();
  });
});
