import { REFERRAL_DISCLOSURE as PARTNER_DISCLOSURE } from '../partners/partner.service';
import {
  AI_LIMITATIONS,
  LEGAL_UPDATED,
  MEDICAL_DISCLAIMER,
  PRIVACY_SECTIONS,
  REFERRAL_DISCLOSURE,
  TERMS_SECTIONS,
  legalSection,
} from './legal-copy';

describe('legal copy', () => {
  it('reuses the traveler referral disclosure', () => {
    expect(REFERRAL_DISCLOSURE).toBe(PARTNER_DISCLOSURE);
    expect(REFERRAL_DISCLOSURE).toContain('commission');
  });

  it('states AI limits and a medical disclaimer with 999 / 112', () => {
    expect(AI_LIMITATIONS.join(' ')).toMatch(/not a doctor/i);
    expect(AI_LIMITATIONS.join(' ')).toMatch(/999/);
    expect(MEDICAL_DISCLAIMER).toMatch(/not a medical service/i);
    expect(MEDICAL_DISCLAIMER).toMatch(/antibiotic/i);
    expect(MEDICAL_DISCLAIMER).toMatch(/999/);
    expect(MEDICAL_DISCLAIMER).toMatch(/112/);
    expect(LEGAL_UPDATED).toContain('2026');
  });

  it('puts referral, AI, and medical sections on both legal pages', () => {
    for (const sections of [PRIVACY_SECTIONS, TERMS_SECTIONS]) {
      expect(legalSection(sections, 'referral-disclosure')?.tone).toBe('referral');
      expect(legalSection(sections, 'ai-limitations')?.tone).toBe('ai');
      expect(legalSection(sections, 'medical-disclaimer')?.tone).toBe('medical');
      expect(legalSection(sections, 'referral-disclosure')?.paragraphs.join(' ')).toContain(
        REFERRAL_DISCLOSURE,
      );
    }
  });
});
