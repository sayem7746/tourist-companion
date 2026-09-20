import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { convertToParamMap, provideRouter, Router, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AdminPartnerEditor } from './admin-partner-editor';
import { partnerSaveError, type OpsPartner } from './partner-admin.service';

const partner: OpsPartner = {
  id: '22222222-2222-4222-8222-222222222222',
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
    sponsored: false,
    connectivityKind: 'esim',
    passportRequired: true,
  },
  commission: { rate: 0.08, currency: 'MYR', basis: 'activation' },
};

describe('AdminPartnerEditor', () => {
  describe('create', () => {
    let fixture: ComponentFixture<AdminPartnerEditor>;
    let component: AdminPartnerEditor;
    let http: HttpTestingController;
    let router: Router;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AdminPartnerEditor],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      }).compileComponents();

      fixture = TestBed.createComponent(AdminPartnerEditor);
      component = fixture.componentInstance;
      http = TestBed.inject(HttpTestingController);
      router = TestBed.inject(Router);
      spyOn(router, 'navigateByUrl').and.resolveTo(true);
      fixture.detectChanges();
    });

    afterEach(() => {
      http.verify();
    });

    it('creates a paused listing and opens the editor', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('h1')?.textContent).toContain('New partner');

      component.name = 'CelcomDigi eSIM';
      component.onCategoryChange('sim');
      component.website = 'https://www.celcomdigi.com/';
      component.contactEmail = 'partners@celcomdigi.example';
      component.summary = 'Airport prepaid SIM and eSIM packs after KLIA customs.';
      component.bookingUrl = 'https://www.celcomdigi.com/book';
      component.connectivityKind = 'esim';
      component.commissionRate = 0.08;
      component.submit();

      const req = http.expectOne(`${environment.apiBaseUrl}/admin/partners`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      expect(req.request.body).toEqual(
        jasmine.objectContaining({
          name: 'CelcomDigi eSIM',
          category: 'sim',
          contactEmail: 'partners@celcomdigi.example',
          listing: jasmine.objectContaining({
            summary: 'Airport prepaid SIM and eSIM packs after KLIA customs.',
            bookingUrl: 'https://www.celcomdigi.com/book',
            connectivityKind: 'esim',
          }),
          commission: jasmine.objectContaining({
            rate: 0.08,
            basis: 'activation',
            currency: 'MYR',
          }),
        }),
      );
      expect(req.request.body.isActive).toBeUndefined();
      expect(req.request.body.listing.airportCodes).toBeUndefined();
      req.flush({ partner });
      expect(router.navigateByUrl).toHaveBeenCalledWith(`/admin/partners/${partner.id}`);
    });

    it('maps save errors', () => {
      expect(
        partnerSaveError(new HttpErrorResponse({ status: 409, statusText: 'Conflict' })),
      ).toContain('slug already exists');
    });
  });

  describe('edit', () => {
    let fixture: ComponentFixture<AdminPartnerEditor>;
    let component: AdminPartnerEditor;
    let http: HttpTestingController;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AdminPartnerEditor],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: convertToParamMap({ id: partner.id }) } },
          },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(AdminPartnerEditor);
      component = fixture.componentInstance;
      http = TestBed.inject(HttpTestingController);
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      fixture.detectChanges();
    });

    afterEach(() => {
      http.verify();
    });

    it('loads, patches, and approves an existing partner', () => {
      const req = http.expectOne(`${environment.apiBaseUrl}/admin/partners/${partner.id}`);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBeTrue();
      req.flush({ partner });
      fixture.detectChanges();

      expect(component.name).toBe('CelcomDigi eSIM');
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('h1')?.textContent).toContain('Edit partner');
      expect(compiled.textContent).toContain('Paused');

      component.summary = 'Airport prepaid SIM packs after KLIA customs.';
      component.submit();
      const patch = http.expectOne(`${environment.apiBaseUrl}/admin/partners/${partner.id}`);
      expect(patch.request.method).toBe('PATCH');
      expect(patch.request.body.listing.summary).toBe(
        'Airport prepaid SIM packs after KLIA customs.',
      );
      expect(patch.request.body.listing.connectivityKind).toBe('esim');
      expect(patch.request.body.listing.airportCodes).toBeUndefined();
      patch.flush({
        partner: { ...partner, listing: { ...partner.listing!, summary: component.summary } },
      });

      component.approve();
      const saved = http.expectOne(`${environment.apiBaseUrl}/admin/partners/${partner.id}`);
      expect(saved.request.method).toBe('PATCH');
      saved.flush({ partner });
      const approved = http.expectOne(
        `${environment.apiBaseUrl}/admin/partners/${partner.id}/approve`,
      );
      expect(approved.request.method).toBe('POST');
      expect(approved.request.withCredentials).toBeTrue();
      approved.flush({ partner: { ...partner, isActive: true } });
      expect(component.isActive()).toBeTrue();
    });

    it('pauses and deletes from the workflow', () => {
      http.expectOne(`${environment.apiBaseUrl}/admin/partners/${partner.id}`).flush({
        partner: { ...partner, isActive: true },
      });
      fixture.detectChanges();

      component.pause();
      const paused = http.expectOne(`${environment.apiBaseUrl}/admin/partners/${partner.id}/pause`);
      expect(paused.request.method).toBe('POST');
      expect(paused.request.withCredentials).toBeTrue();
      paused.flush({ partner: { ...partner, isActive: false } });
      expect(component.isActive()).toBeFalse();

      spyOn(window, 'confirm').and.returnValue(true);
      component.remove();
      const deleted = http.expectOne(`${environment.apiBaseUrl}/admin/partners/${partner.id}`);
      expect(deleted.request.method).toBe('DELETE');
      deleted.flush(null);
      expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/admin/partners');
    });
  });
});
