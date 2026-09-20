import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AdminPartners } from './admin-partners';
import {
  buildPartnerListingDraft,
  defaultCommissionBasis,
  filterListedPartners,
  hasHttpsOutbound,
  partnerActionError,
  partnerApprovalBlockers,
  partnerLanguageCodes,
  partnerListParams,
  selectedAirportCodes,
  splitPartnerLines,
  type OpsPartner,
} from './partner-admin.service';

const partner: OpsPartner = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'CelcomDigi eSIM',
  slug: 'celcomdigi-esim',
  category: 'sim',
  isActive: false,
  website: 'https://www.celcomdigi.com/',
  contactEmail: 'partners@celcomdigi.example',
  listing: {
    summary: 'Airport prepaid SIM and eSIM packs after KLIA customs.',
    city: 'Sepang',
    bookingUrl: 'https://www.celcomdigi.com/book',
    disclosure: 'We may earn a commission if you book or buy through this link.',
    sponsored: true,
  },
  commission: { rate: 0.08, currency: 'MYR', basis: 'activation' },
};

describe('partner admin helpers', () => {
  it('builds list filters and search', () => {
    expect(partnerListParams().keys()).toEqual([]);
    expect(partnerListParams('sim', 'active').get('category')).toBe('sim');
    expect(partnerListParams('all', 'paused').get('isActive')).toBe('false');
    expect(splitPartnerLines('en\nms, zh')).toEqual(['en', 'ms', 'zh']);
    expect(partnerLanguageCodes('en, Malaysian, zh-Hans')).toEqual(['en', 'zh-hans']);
    expect(defaultCommissionBasis('sim')).toBe('activation');
    expect(defaultCommissionBasis('hotels')).toBe('booking');
    expect(selectedAirportCodes(true, false)).toEqual(['KUL']);
    expect(filterListedPartners([partner], 'sepang').map((row) => row.id)).toEqual([partner.id]);
    expect(filterListedPartners([partner], 'penang')).toEqual([]);
  });

  it('blocks approve until listing, contact, HTTPS URL, and rate are set', () => {
    expect(partnerApprovalBlockers(partner)).toEqual([]);
    expect(
      hasHttpsOutbound({ website: 'http://example.com', listing: { bookingUrl: null } }),
    ).toBeFalse();
    expect(
      partnerApprovalBlockers({ ...partner, contactEmail: null, listing: { summary: '' } }),
    ).toEqual(['Add a verified listing summary', 'Add an ops contact email']);
    expect(
      partnerApprovalBlockers({
        ...partner,
        website: 'http://example.com',
        listing: { summary: partner.listing!.summary, bookingUrl: 'http://example.com/book' },
      }),
    ).toContain('Add an HTTPS booking, reservation, or website URL');
    expect(
      partnerActionError(new HttpErrorResponse({ status: 409, statusText: 'Conflict' }), 'delete'),
    ).toContain('Pause the listing');
  });

  it('sends only the extras for the selected category', () => {
    const sim = buildPartnerListingDraft({
      category: 'sim',
      summary: 'Airport prepaid SIM packs.',
      city: 'Sepang',
      area: '',
      bookingUrl: 'https://www.celcomdigi.com/book',
      reservationUrl: '',
      disclosure: '',
      sponsored: false,
      licenseName: '',
      licenseId: '',
      typicalMyr: '',
      languagesText: 'en, ms',
      hotelClassHint: '4-star area',
      vehicleClass: 'sedan',
      kul: true,
      klia2: false,
      meetAndGreet: 'true',
      durationHint: '4 hours',
      meetingPoint: 'KLCC',
      connectivityKind: 'esim',
      dataAllowance: '10 GB',
      validity: '10 days',
      passportRequired: 'true',
      halal: 'true',
      deskHours: '08:00–22:00',
    });
    expect(sim).toEqual(
      jasmine.objectContaining({
        summary: 'Airport prepaid SIM packs.',
        languages: ['en', 'ms'],
        connectivityKind: 'esim',
        dataAllowance: '10 GB',
        passportRequired: true,
      }),
    );
    expect(sim.hotelClassHint).toBeUndefined();
    expect(sim.airportCodes).toBeUndefined();
    expect(sim.halal).toBeUndefined();
  });
});

describe('AdminPartners', () => {
  let fixture: ComponentFixture<AdminPartners>;
  let component: AdminPartners;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPartners],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPartners);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('lists partners and filters by category', () => {
    const req = http.expectOne(`${environment.apiBaseUrl}/admin/partners`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ partners: [partner] });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Partners');
    expect(compiled.textContent).toContain('CelcomDigi eSIM');
    expect(compiled.querySelector('a.btn')?.getAttribute('href')).toBe('/admin/partners/new');
    expect(compiled.textContent).toContain('Paused');
    expect(compiled.textContent).toContain('Sponsored');
    expect(compiled.querySelector('.chip-gold')?.textContent).toContain('Sponsored');

    component.filterCategory('sim');
    const filtered = http.expectOne(`${environment.apiBaseUrl}/admin/partners?category=sim`);
    filtered.flush({ partners: [partner] });
  });

  it('filters by paused status with admin JWT cookies', () => {
    http.expectOne(`${environment.apiBaseUrl}/admin/partners`).flush({ partners: [partner] });
    component.setActive('paused');
    const filtered = http.expectOne(`${environment.apiBaseUrl}/admin/partners?isActive=false`);
    expect(filtered.request.withCredentials).toBeTrue();
    filtered.flush({ partners: [partner] });
  });

  it('approves, pauses, and deletes a row', () => {
    http.expectOne(`${environment.apiBaseUrl}/admin/partners`).flush({ partners: [partner] });
    fixture.detectChanges();

    component.toggleStatus(partner);
    const approved = http.expectOne(
      `${environment.apiBaseUrl}/admin/partners/${partner.id}/approve`,
    );
    expect(approved.request.method).toBe('POST');
    expect(approved.request.withCredentials).toBeTrue();
    approved.flush({ partner: { ...partner, isActive: true } });
    expect(component.items()[0].isActive).toBeTrue();

    component.toggleStatus({ ...partner, isActive: true });
    const paused = http.expectOne(`${environment.apiBaseUrl}/admin/partners/${partner.id}/pause`);
    expect(paused.request.method).toBe('POST');
    paused.flush({ partner: { ...partner, isActive: false } });
    expect(component.items()[0].isActive).toBeFalse();

    spyOn(window, 'confirm').and.returnValue(true);
    component.remove(partner);
    const deleted = http.expectOne(`${environment.apiBaseUrl}/admin/partners/${partner.id}`);
    expect(deleted.request.method).toBe('DELETE');
    deleted.flush(null);
    expect(component.items()).toEqual([]);
  });

  it('does not approve an incomplete listing', () => {
    const incomplete = { ...partner, contactEmail: null, commission: undefined };
    http.expectOne(`${environment.apiBaseUrl}/admin/partners`).flush({ partners: [incomplete] });
    fixture.detectChanges();

    const approve = (fixture.nativeElement as HTMLElement).querySelector(
      '.row-actions .btn-secondary',
    ) as HTMLButtonElement;
    expect(approve.disabled).toBeTrue();
    expect(approve.title).toContain('Cannot approve yet');

    component.toggleStatus(incomplete);
    http.expectNone(`${environment.apiBaseUrl}/admin/partners/${partner.id}/approve`);
    expect(component.actionError()).toContain('Cannot approve');
  });

  it('keeps a referred partner when delete conflicts', () => {
    http.expectOne(`${environment.apiBaseUrl}/admin/partners`).flush({ partners: [partner] });
    spyOn(window, 'confirm').and.returnValue(true);
    component.remove(partner);
    http
      .expectOne(`${environment.apiBaseUrl}/admin/partners/${partner.id}`)
      .flush({ error: 'conflict' }, { status: 409, statusText: 'Conflict' });
    expect(component.items()).toEqual([partner]);
    expect(component.actionError()).toContain('Pause the listing');
  });
});
