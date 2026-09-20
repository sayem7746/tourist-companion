import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { convertToParamMap, provideRouter, Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminContentEditor, contentSaveError } from './admin-content-editor';
import { HttpErrorResponse } from '@angular/common/http';
import type { ContentItem } from './content.service';

const item: ContentItem = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'dress-code-for-batu-caves',
  kind: 'etiquette',
  title: 'Dress code for Batu Caves',
  summary: 'Cover shoulders and knees.',
  body: 'Wear clothing that covers shoulders and knees.',
  tags: ['temple'],
  area: 'Batu Caves, Selangor',
  airportCode: null,
  topic: null,
  whenToUse: null,
  icon: null,
  steps: [],
  sortOrder: 1,
  published: true,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

describe('AdminContentEditor', () => {
  describe('create', () => {
    let fixture: ComponentFixture<AdminContentEditor>;
    let component: AdminContentEditor;
    let http: HttpTestingController;
    let router: Router;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AdminContentEditor],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      }).compileComponents();

      fixture = TestBed.createComponent(AdminContentEditor);
      component = fixture.componentInstance;
      http = TestBed.inject(HttpTestingController);
      router = TestBed.inject(Router);
      spyOn(router, 'navigateByUrl').and.resolveTo(true);
      fixture.detectChanges();
    });

    afterEach(() => {
      http.verify();
    });

    it('creates an article and opens the editor', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('h1')?.textContent).toContain('New article');

      component.kind = 'faq';
      component.title = 'Power plugs and voltage';
      component.body = 'Malaysia uses Type G plugs.';
      component.submit();

      const req = http.expectOne(`${environment.apiBaseUrl}/admin/content`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      expect(req.request.body).toEqual(
        jasmine.objectContaining({
          kind: 'faq',
          title: 'Power plugs and voltage',
          body: 'Malaysia uses Type G plugs.',
        }),
      );
      req.flush({ item });
      expect(router.navigateByUrl).toHaveBeenCalledWith(`/admin/content/${item.id}`);
    });

    it('maps save errors', () => {
      expect(
        contentSaveError(new HttpErrorResponse({ status: 409, statusText: 'Conflict' })),
      ).toContain('slug already exists');
    });
  });

  describe('edit', () => {
    let fixture: ComponentFixture<AdminContentEditor>;
    let component: AdminContentEditor;
    let http: HttpTestingController;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AdminContentEditor],
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

      fixture = TestBed.createComponent(AdminContentEditor);
      component = fixture.componentInstance;
      http = TestBed.inject(HttpTestingController);
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      fixture.detectChanges();
    });

    afterEach(() => {
      http.verify();
    });

    it('loads and patches an existing article', () => {
      const req = http.expectOne(`${environment.apiBaseUrl}/admin/content/${item.id}`);
      expect(req.request.method).toBe('GET');
      req.flush({ item });
      fixture.detectChanges();

      expect(component.title).toBe('Dress code for Batu Caves');
      expect(component.showArea()).toBeTrue();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('h1')?.textContent).toContain('Edit article');

      component.summary = 'Cover shoulders and knees for the temple.';
      component.submit();
      const patch = http.expectOne(`${environment.apiBaseUrl}/admin/content/${item.id}`);
      expect(patch.request.method).toBe('PATCH');
      expect(patch.request.body.summary).toBe('Cover shoulders and knees for the temple.');
      patch.flush({ item: { ...item, summary: component.summary } });
    });
  });
});
