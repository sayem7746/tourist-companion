import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AI_LIMITATIONS,
  MEDICAL_DISCLAIMER,
  REFERRAL_DISCLOSURE,
  TERMS_LEDE,
  TERMS_TITLE,
} from './legal-copy';
import { Terms } from './terms';

describe('Terms', () => {
  let fixture: ComponentFixture<Terms>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Terms],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Terms);
    fixture.detectChanges();
  });

  it('renders MVP terms with referral disclosure and AI / medical limits', () => {
    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(host.querySelector('h1')?.textContent).toContain(TERMS_TITLE);
    expect(text).toContain(TERMS_LEDE);
    expect(text).toContain(REFERRAL_DISCLOSURE);
    expect(text).toContain(MEDICAL_DISCLAIMER);
    for (const line of AI_LIMITATIONS) {
      expect(text).toContain(line);
    }
    expect(text).toMatch(/not a booking contract/i);
    expect(text).toMatch(/do not sell tickets/i);
    expect(
      host.querySelector('[data-section="referral-disclosure"]')?.getAttribute('data-tone'),
    ).toBe('referral');
    expect(host.querySelector('[data-section="ai-limitations"]')?.getAttribute('data-tone')).toBe(
      'ai',
    );
    expect(
      host.querySelector('[data-section="medical-disclaimer"]')?.getAttribute('data-tone'),
    ).toBe('medical');
    expect(host.querySelector('a[href="/privacy"]')?.textContent).toMatch(/privacy/i);
    expect(host.querySelector('a[href="/emergency"]')?.textContent).toMatch(/Emergency/);
  });
});
