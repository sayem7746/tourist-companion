import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { convertToParamMap, provideRouter, Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminFaqEditor, faqSaveError } from './admin-faq-editor';
import { HttpErrorResponse } from '@angular/common/http';
import type { FaqItem } from './faq.service';

const item: FaqItem = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'are-dew-kiosks-open-overnight-in-pj',
  title: 'Are dew kiosks open overnight in PJ?',
  summary: 'Dew kiosks close overnight.',
  body: 'Buy sealed water before 22:00.',
  tags: ['dew-kiosk'],
  topic: 'safety_non_emergency',
  sortOrder: 1,
  published: true,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

describe('AdminFaqEditor', () => {
  describe('create', () => {
    let fixture: ComponentFixture<AdminFaqEditor>;
    let component: AdminFaqEditor;
    let http: HttpTestingController;
    let router: Router;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AdminFaqEditor],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      }).compileComponents();

      fixture = TestBed.createComponent(AdminFaqEditor);
      component = fixture.componentInstance;
      http = TestBed.inject(HttpTestingController);
      router = TestBed.inject(Router);
      spyOn(router, 'navigateByUrl').and.resolveTo(true);
      fixture.detectChanges();
    });

    afterEach(() => {
      http.verify();
    });

    it('creates an FAQ and opens the editor', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('h1')?.textContent).toContain('New FAQ');

      component.title = 'Are dew kiosks open overnight in PJ?';
      component.body = 'Dew kiosks stay closed overnight.';
      component.topic = 'safety_non_emergency';
      component.submit();

      const req = http.expectOne(`${environment.apiBaseUrl}/admin/faqs`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      expect(req.request.body).toEqual(
        jasmine.objectContaining({
          title: 'Are dew kiosks open overnight in PJ?',
          body: 'Dew kiosks stay closed overnight.',
          topic: 'safety_non_emergency',
        }),
      );
      req.flush({ item });
      expect(router.navigateByUrl).toHaveBeenCalledWith(`/admin/faqs/${item.id}`);
    });

    it('maps save errors', () => {
      expect(faqSaveError(new HttpErrorResponse({ status: 409, statusText: 'Conflict' }))).toContain(
        'slug already exists',
      );
    });
  });

  describe('edit', () => {
    let fixture: ComponentFixture<AdminFaqEditor>;
    let component: AdminFaqEditor;
    let http: HttpTestingController;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AdminFaqEditor],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: convertToParamMap({ id: item.id }) } },
          },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(AdminFaqEditor);
      component = fixture.componentInstance;
      http = TestBed.inject(HttpTestingController);
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      fixture.detectChanges();
    });

    afterEach(() => {
      http.verify();
    });

    it('loads and patches an existing FAQ', () => {
      const req = http.expectOne(`${environment.apiBaseUrl}/admin/faqs/${item.id}`);
      expect(req.request.method).toBe('GET');
      req.flush({ item });
      fixture.detectChanges();

      expect(component.title).toBe('Are dew kiosks open overnight in PJ?');
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('h1')?.textContent).toContain('Edit FAQ');

      component.summary = 'Closed after 22:00.';
      component.submit();
      const patch = http.expectOne(`${environment.apiBaseUrl}/admin/faqs/${item.id}`);
      expect(patch.request.method).toBe('PATCH');
      expect(patch.request.body.summary).toBe('Closed after 22:00.');
      patch.flush({ item: { ...item, summary: component.summary } });
    });
  });
});
