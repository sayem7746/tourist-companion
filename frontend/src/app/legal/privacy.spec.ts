import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MEDICAL_DISCLAIMER, PRIVACY_LEDE, PRIVACY_TITLE, REFERRAL_DISCLOSURE } from './legal-copy';
import { Privacy } from './privacy';

describe('Privacy', () => {
  let fixture: ComponentFixture<Privacy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Privacy],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Privacy);
    fixture.detectChanges();
  });

  it('renders the MVP privacy notice with referral, AI, and medical copy', () => {
    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(host.querySelector('h1')?.textContent).toContain(PRIVACY_TITLE);
    expect(text).toContain(PRIVACY_LEDE);
    expect(text).toContain(REFERRAL_DISCLOSURE);
    expect(text).toContain(MEDICAL_DISCLAIMER);
    expect(text).toMatch(/tc_access/);
    expect(text).toMatch(/PDPA/);
    expect(text).toMatch(/third-party AI processor/);
    expect(
      host.querySelector('[data-section="referral-disclosure"]')?.getAttribute('data-tone'),
    ).toBe('referral');
    expect(host.querySelector('[data-section="ai-limitations"]')?.getAttribute('data-tone')).toBe(
      'ai',
    );
    expect(
      host.querySelector('[data-section="medical-disclaimer"]')?.getAttribute('data-tone'),
    ).toBe('medical');
    expect(host.querySelector('a[href="/terms"]')?.textContent).toMatch(/terms/i);
    expect(host.querySelector('a[href="/emergency"]')?.textContent).toMatch(/Emergency/);
  });
});
