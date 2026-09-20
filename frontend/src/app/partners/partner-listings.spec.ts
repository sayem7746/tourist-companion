import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { PartnerListings } from './partner-listings';
import {
  REFERRAL_DISCLOSURE,
  SPONSORED_BADGE_COLOR,
  SPONSORED_BADGE_LABEL,
  SPONSORED_BADGE_TINT,
  filterPublicPartners,
  nearbyPartnerCategories,
  partnerCtaLabel,
  partnerOutboundUrl,
  type TouristProvider,
} from './partner.service';

function partner(partial: Partial<TouristProvider> & Pick<TouristProvider, 'id' | 'name'>): TouristProvider {
  return {
    slug: partial.slug ?? partial.name.toLowerCase().replace(/\s+/g, '-'),
    category: 'tours',
    isActive: true,
    website: 'https://www.klook.com/',
    listing: {
      summary: 'Day tours and tickets in Kuala Lumpur.',
      city: 'Kuala Lumpur',
      area: 'KLCC',
      bookingUrl: 'https://www.klook.com/',
      disclosure: REFERRAL_DISCLOSURE,
      sponsored: true,
      typicalMyr: 'RM 80–250',
      durationHint: 'Half day',
    },
    ...partial,
  };
}

describe('partner listing helpers', () => {
  it('maps nearby chips to partner categories and ranks sponsored first', () => {
    expect(nearbyPartnerCategories('food')).toEqual(['restaurants']);
    expect(nearbyPartnerCategories('attractions')).toEqual(['tours']);
    expect(nearbyPartnerCategories('atm')).toEqual([]);
    expect(nearbyPartnerCategories('all')).toEqual(['restaurants', 'tours', 'tourist_services']);
    expect(partnerCtaLabel('sim')).toBe('Get SIM / eSIM');
    expect(partnerOutboundUrl(partner({ id: 'p1', name: 'Klook' }))).toBe('https://www.klook.com/');

    const ranked = filterPublicPartners([
      partner({
        id: 'organic',
        name: 'Grab Malaysia',
        category: 'transfers',
        listing: {
          summary: 'Rides',
          bookingUrl: 'https://www.grab.com/my/',
          disclosure: REFERRAL_DISCLOSURE,
          sponsored: false,
        },
      }),
      partner({ id: 'paid', name: 'Klook Malaysia' }),
    ]);
    expect(ranked.map((row) => row.id)).toEqual(['paid', 'organic']);
  });
});

describe('PartnerListings', () => {
  let fixture: ComponentFixture<PartnerListings>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnerListings],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnerListings);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function compiled(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function flushPartners(partners: TouristProvider[]): void {
    const req = http.expectOne(`${environment.apiBaseUrl}/partners`);
    expect(req.request.method).toBe('GET');
    req.flush({ partners });
    fixture.detectChanges();
  }

  it('paints the gold Sponsored badge and referral disclosure', () => {
    fixture.componentInstance.heading = 'Partner services nearby';
    fixture.componentInstance.channel = 'explore';
    fixture.detectChanges();
    flushPartners([partner({ id: 'klook', name: 'Klook Malaysia' })]);

    const text = compiled().textContent ?? '';
    expect(text).toContain('Partner services nearby');
    expect(text).toContain('Klook Malaysia');
    expect(text).toContain('Tours');
    expect(text).toContain(SPONSORED_BADGE_LABEL);
    expect(text).toContain(REFERRAL_DISCLOSURE);
    expect(text).toContain('RM 80–250');
    const badge = compiled().querySelector('.sponsored-badge') as HTMLElement;
    expect(badge.textContent?.trim()).toBe(SPONSORED_BADGE_LABEL);
    expect(badge.style.color.replace(/\s/g, '').toLowerCase()).toMatch(/#d97706|rgb\(217,119,6\)/);
    expect(badge.style.background.replace(/\s/g, '').toLowerCase()).toMatch(/#fef3c7|rgb\(254,243,199\)/);
    expect(SPONSORED_BADGE_COLOR).toBe('#D97706');
    expect(SPONSORED_BADGE_TINT).toBe('#FEF3C7');
    expect(compiled().querySelector('[data-sponsored="true"]')).toBeTruthy();
    expect(badge.getAttribute('role')).toBe('status');
  });

  it('hides listings that are not relevant to the nearby category', () => {
    fixture.componentInstance.categories = ['restaurants'];
    fixture.detectChanges();
    flushPartners([partner({ id: 'klook', name: 'Klook Malaysia' })]);
    expect(compiled().textContent).not.toContain('Klook Malaysia');
    expect(compiled().querySelector('.partner-card')).toBeNull();
  });

  it('omits the Sponsored badge for organic affiliates but still discloses', () => {
    fixture.detectChanges();
    flushPartners([
      partner({
        id: 'grab',
        name: 'Grab Malaysia',
        category: 'transfers',
        listing: {
          summary: 'Licensed e-hailing rides.',
          bookingUrl: 'https://www.grab.com/my/',
          disclosure: REFERRAL_DISCLOSURE,
          sponsored: false,
        },
      }),
    ]);
    expect(compiled().textContent).toContain('Grab Malaysia');
    expect(compiled().textContent).toContain(REFERRAL_DISCLOSURE);
    expect(compiled().querySelector('.sponsored-badge')).toBeNull();
    expect(compiled().querySelector('[data-sponsored="false"]')).toBeTruthy();
  });

  it('records a click then opens the tracked outbound URL', () => {
    const open = spyOn(window, 'open');
    fixture.componentInstance.channel = 'arrival';
    fixture.componentInstance.tripId = 'trip-1';
    fixture.detectChanges();
    flushPartners([
      partner({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'CelcomDigi tourist eSIM',
        category: 'sim',
        listing: {
          summary: 'Airport eSIM packs.',
          bookingUrl: 'https://www.celcomdigi.com/',
          disclosure: REFERRAL_DISCLOSURE,
          sponsored: false,
        },
      }),
    ]);

    (compiled().querySelector('button.btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    const click = http.expectOne(`${environment.apiBaseUrl}/referrals/clicks`);
    expect(click.request.method).toBe('POST');
    expect(click.request.withCredentials).toBeTrue();
    expect(click.request.body).toEqual(
      jasmine.objectContaining({
        providerId: '11111111-1111-4111-8111-111111111111',
        channel: 'arrival',
        tripId: 'trip-1',
      }),
    );
    click.flush({
      referral: {
        id: 'ref-1',
        userId: 'user-1',
        providerId: '11111111-1111-4111-8111-111111111111',
        referralCode: 'ABC',
        status: 'clicked',
        channel: 'arrival',
      },
      created: true,
      outboundUrl: 'https://www.celcomdigi.com/?ref=ABC',
      redirectPath: '/r/ABC',
    });
    expect(open).toHaveBeenCalledWith('https://www.celcomdigi.com/?ref=ABC', '_blank', 'noopener,noreferrer');
  });

  it('opens the listing URL when click tracking is unauthorized', () => {
    const open = spyOn(window, 'open');
    fixture.detectChanges();
    flushPartners([partner({ id: 'klook', name: 'Klook Malaysia' })]);
    (compiled().querySelector('button.btn') as HTMLButtonElement).click();
    http
      .expectOne(`${environment.apiBaseUrl}/referrals/clicks`)
      .flush({ error: 'unauthenticated' }, { status: 401, statusText: 'Unauthorized' });
    expect(open).toHaveBeenCalledWith('https://www.klook.com/', '_blank', 'noopener,noreferrer');
  });
});
