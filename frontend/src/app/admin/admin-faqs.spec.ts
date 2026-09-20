import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminFaqs } from './admin-faqs';
import { faqListParams, splitFaqLines, type FaqItem } from './faq.service';

const faq: FaqItem = {
  id: '11111111-1111-4111-8111-111111111111',
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

describe('FAQ helpers', () => {
  it('builds list filters', () => {
    expect(faqListParams().keys()).toEqual([]);
    expect(faqListParams('safety_non_emergency', 'published', 'dew').get('topic')).toBe(
      'safety_non_emergency',
    );
    expect(faqListParams('all', 'draft', 'dew').get('published')).toBe('false');
    expect(splitFaqLines('one\ntwo, three')).toEqual(['one', 'two', 'three']);
  });
});

describe('AdminFaqs', () => {
  let fixture: ComponentFixture<AdminFaqs>;
  let component: AdminFaqs;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminFaqs],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminFaqs);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('lists FAQs and filters by topic', () => {
    const req = http.expectOne(`${environment.apiBaseUrl}/admin/faqs`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ topics: ['safety_non_emergency'], items: [faq] });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('FAQs');
    expect(compiled.textContent).toContain('Are dew kiosks open overnight in PJ?');
    expect(compiled.querySelector('a.btn')?.getAttribute('href')).toBe('/admin/faqs/new');

    component.filterTopic('safety_non_emergency');
    const filtered = http.expectOne(
      `${environment.apiBaseUrl}/admin/faqs?topic=safety_non_emergency`,
    );
    filtered.flush({ topics: ['safety_non_emergency'], topic: 'safety_non_emergency', items: [faq] });
  });

  it('publishes and deletes a row', () => {
    http.expectOne(`${environment.apiBaseUrl}/admin/faqs`).flush({ items: [faq] });
    fixture.detectChanges();

    component.togglePublished(faq);
    const publish = http.expectOne(`${environment.apiBaseUrl}/admin/faqs/${faq.id}/unpublish`);
    expect(publish.request.method).toBe('POST');
    publish.flush({ item: { ...faq, published: false } });
    expect(component.items()[0].published).toBeFalse();

    spyOn(window, 'confirm').and.returnValue(true);
    component.remove(faq);
    const deleted = http.expectOne(`${environment.apiBaseUrl}/admin/faqs/${faq.id}`);
    expect(deleted.request.method).toBe('DELETE');
    deleted.flush(null);
    expect(component.items()).toEqual([]);
  });
});
