import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { Concierge, formatRetentionNote, historyFromTurns } from './concierge';
import {
  DEFAULT_LIVE_CONTEXT,
  SOS_COLOR,
  SUGGESTED_CHIPS,
  type ConciergeChatResponse,
} from './concierge.service';

function normalizedColor(value: string): string {
  const hex = value.trim().toLowerCase();
  if (hex === '#e11d48') {
    return 'rgb(225, 29, 72)';
  }
  return value.replace(/\s+/g, ' ').trim();
}

function reply(partial: Partial<ConciergeChatResponse> = {}): ConciergeChatResponse {
  return {
    conversationId: 'conv-1',
    category: 'nearby_dining',
    escalationLevel: 'none',
    mode: 'retrieve_and_rank',
    reply: {
      text: 'Welcome to Bukit Bintang, Alex! Try chicken rice with chili on the side.',
      placeCards: [
        {
          name: 'Hainanese chicken rice (hawker or food court)',
          area: 'KLCC / Bukit Bintang food courts',
          badge: 'Kid Favorite',
          priceBandMyr: 'RM 10–18',
          why: 'Poached chicken, rice, cucumber — chili on the side so kids can skip heat.',
        },
      ],
      phraseTips: [
        { phrase: 'Tak pedas', pronunciation: 'tahk puh-DAHS', meaning: 'No chili / Not spicy' },
      ],
      followUpChips: ['Bukit Bintang Food Map', 'Directions to Jalan Alor', 'Ask about Vegetarian options'],
      trustLine: 'Verified cultural etiquette & local transport safety checked',
      sos: null,
    },
    citations: [],
    analytics: { category: 'nearby_dining', escalationLevel: 'none' },
    ...partial,
  };
}

describe('historyFromTurns', () => {
  it('sends the last ten completed turns excluding the current user message', () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `m${i}`,
    }));
    turns.push({ role: 'user', content: 'latest' });
    const history = historyFromTurns(turns);
    expect(history).toHaveSize(10);
    expect(history[0]).toEqual({ role: 'user', content: 'm2' });
    expect(history.at(-1)).toEqual({ role: 'assistant', content: 'm11' });
  });
});

describe('Concierge', () => {
  let fixture: ComponentFixture<Concierge>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Concierge],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Concierge);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne(`${environment.apiBaseUrl}/auth/me`)
      .flush({ error: 'unauthenticated' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  function compiled(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the Stitch Malaysia AI Concierge chrome, chips, and SOS', () => {
    const text = compiled().textContent ?? '';
    expect(compiled().querySelector('h1')?.textContent).toContain('Malaysia AI Concierge');
    expect(text).toContain('Your 24/7 friendly local guide');
    expect(text).toContain('Live context: Bukit Bintang, KL • Family trip');
    expect(compiled().querySelector('#concierge-draft')?.getAttribute('placeholder')).toContain(
      'Ask me anything about Malaysia',
    );
    for (const chip of SUGGESTED_CHIPS) {
      expect(text).toContain(chip.label);
    }
    const sos = compiled().querySelector('.sos-btn') as HTMLElement;
    expect(sos.getAttribute('data-path')).toBe('emergency-help');
    expect(sos.textContent).toContain('SOS');
    expect(normalizedColor(sos.style.background)).toBe('rgb(225, 29, 72)');
    expect(SOS_COLOR).toBe('#E11D48');
    expect(compiled().querySelector('#emergency-help')).toBeNull();
  });

  it('POSTs a suggestion chip to /concierge/chat with credentials', () => {
    const spice = compiled().querySelector('button[data-label="Is this food spicy?"]') as HTMLButtonElement;
    spice.click();
    fixture.detectChanges();

    expect(compiled().textContent).toContain('Concierge is thinking…');

    const req = http.expectOne(`${environment.apiBaseUrl}/concierge/chat`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({
      message: 'Is this food spicy?',
      conversationId: undefined,
      tripId: undefined,
      history: [],
      context: DEFAULT_LIVE_CONTEXT,
      categoryHint: 'food_spice_diet',
    });
    req.flush(reply({ category: 'food_spice_diet', analytics: { category: 'food_spice_diet', escalationLevel: 'none' } }));
    fixture.detectChanges();

    const text = compiled().textContent ?? '';
    expect(text).toContain('Is this food spicy?');
    expect(text).toContain('Welcome to Bukit Bintang, Alex!');
    expect(text).toContain('Hainanese chicken rice');
    expect(text).toContain('Kid Favorite');
    expect(text).toContain('Tak pedas');
    expect(text).toContain('Smart Local Phrase Tip');
    expect(text).toContain('Bukit Bintang Food Map');
    expect(text).toContain('Verified cultural etiquette');
    expect(text).not.toContain('Concierge is thinking…');
  });

  it('shows an error and retries the last message', () => {
    const lrt = compiled().querySelector('button[data-label="How to ride the LRT?"]') as HTMLButtonElement;
    lrt.click();
    fixture.detectChanges();

    http
      .expectOne(`${environment.apiBaseUrl}/concierge/chat`)
      .flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(compiled().textContent).toContain('Could not reach the concierge');
    (compiled().querySelector('button.btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    const retry = http.expectOne(`${environment.apiBaseUrl}/concierge/chat`);
    expect(retry.request.withCredentials).toBeTrue();
    expect(retry.request.body.message).toBe('How to ride the LRT?');
    expect(retry.request.body.categoryHint).toBe('local_transport');
    retry.flush(reply({ category: 'local_transport' }));
    fixture.detectChanges();
    expect(compiled().textContent).toContain('Welcome to Bukit Bintang, Alex!');
  });

  it('styles SOS replies with #E11D48 and opens emergency-help numbers', () => {
    const sosBtn = compiled().querySelector('.sos-btn') as HTMLButtonElement;
    sosBtn.click();
    fixture.detectChanges();
    const sheet = compiled().querySelector('#emergency-help') as HTMLElement;
    expect(sheet.getAttribute('data-path')).toBe('emergency-help');
    expect(normalizedColor(sheet.style.background)).toBe('rgb(225, 29, 72)');
    expect(sheet.textContent).toContain('999');
    expect(compiled().querySelector('a[href="tel:112"]')?.textContent).toContain('112');
    expect(compiled().querySelector('.sos-btn')?.textContent).toContain('SOS');

    (compiled().querySelector('.sos-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled().querySelector('#emergency-help')).toBeNull();
    expect(compiled().querySelector('.sos-btn')?.textContent).toContain('SOS');

    fixture.componentInstance.draft = 'Someone grabbed my bag and I think they are still following me.';
    fixture.componentInstance.submitDraft();
    fixture.detectChanges();

    const req = http.expectOne(`${environment.apiBaseUrl}/concierge/chat`);
    expect(req.request.withCredentials).toBeTrue();
    req.flush(
      reply({
        category: 'emergency',
        escalationLevel: 'sos',
        analytics: { category: 'emergency', escalationLevel: 'sos' },
        reply: {
          text: 'Stay safe. Call 999 (police, fire, ambulance) or 112 from a mobile network now, and share your location if you can.',
          placeCards: [],
          phraseTips: [],
          followUpChips: [],
          trustLine: null,
          sos: {
            color: '#E11D48',
            path: 'emergency-help',
            numbers: [
              { code: '999', label: 'Police, fire, ambulance' },
              { code: '112', label: 'Mobile networks' },
            ],
          },
        },
      }),
    );
    fixture.detectChanges();

    const card = compiled().querySelector('.sos-card') as HTMLElement;
    expect(card.getAttribute('data-path')).toBe('emergency-help');
    expect(normalizedColor(card.style.background)).toBe('rgb(225, 29, 72)');
    expect(card.textContent).toContain('999');
    expect(card.textContent).not.toContain('Bukit Bintang Food Map');
    expect(compiled().querySelector('#emergency-help')).not.toBeNull();
    expect(compiled().querySelector('.sos-btn')?.textContent).toContain('SOS');
  });
});

describe('formatRetentionNote', () => {
  it('explains last-N retention and skip-emergency storage', () => {
    expect(
      formatRetentionNote({ maxMessages: 20, ttlMs: 7 * 86_400_000, persistEmergency: false }, true),
    ).toContain('last 20 messages for this trip for 7 days');
    expect(
      formatRetentionNote({ maxMessages: 20, ttlMs: 7 * 86_400_000, persistEmergency: false }, false),
    ).toContain('Save a trip');
  });
});

describe('signed-in concierge history', () => {
  let fixture: ComponentFixture<Concierge>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Concierge],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Concierge);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/auth/me`).flush({
      user: { id: 'user-1', email: 'a@b.c', displayName: 'Alex' },
    });
    http.expectOne(`${environment.apiBaseUrl}/concierge/history`).flush({
      tripId: '11111111-1111-4111-8111-111111111111',
      conversationId: 'conv-saved',
      messages: [
        { role: 'user', content: 'How to ride the LRT?', createdAt: '2026-09-20T02:00:00.000Z', expiresAt: '2026-09-27T02:00:00.000Z' },
        { role: 'assistant', content: 'Use Touch n Go.', createdAt: '2026-09-20T02:00:01.000Z', expiresAt: '2026-09-27T02:00:00.000Z' },
      ],
      retention: { maxMessages: 20, ttlMs: 7 * 86_400_000, persistEmergency: false },
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('restores saved turns and can delete them', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('How to ride the LRT?');
    expect(compiled.textContent).toContain('Use Touch n Go.');
    expect(compiled.textContent).toContain('last 20 messages');
    expect(compiled.textContent).toContain('Emergency chats are not stored');

    const spice = compiled.querySelector('button[data-label="Is this food spicy?"]') as HTMLButtonElement;
    spice.click();
    fixture.detectChanges();
    const chat = http.expectOne(`${environment.apiBaseUrl}/concierge/chat`);
    expect(chat.request.body.tripId).toBe('11111111-1111-4111-8111-111111111111');
    expect(chat.request.body.conversationId).toBe('conv-saved');
    expect(chat.request.body.history).toEqual([
      { role: 'user', content: 'How to ride the LRT?' },
      { role: 'assistant', content: 'Use Touch n Go.' },
    ]);
    chat.flush(reply({ conversationId: 'conv-saved', tripId: '11111111-1111-4111-8111-111111111111', persisted: true }));
    fixture.detectChanges();

    (compiled.querySelector('button.btn-secondary') as HTMLButtonElement).click();
    fixture.detectChanges();
    const del = http.expectOne(
      (req) =>
        req.method === 'DELETE' &&
        req.url.startsWith(`${environment.apiBaseUrl}/concierge/history`),
    );
    expect(del.request.withCredentials).toBeTrue();
    expect(del.request.params.get('tripId')).toBe('11111111-1111-4111-8111-111111111111');
    del.flush(null);
    fixture.detectChanges();
    const thread = compiled.querySelector('.thread')?.textContent ?? '';
    expect(thread).not.toContain('How to ride the LRT?');
    expect(thread).not.toContain('Use Touch n Go.');
    expect(thread).not.toContain('Welcome to Bukit Bintang');
  });
});
