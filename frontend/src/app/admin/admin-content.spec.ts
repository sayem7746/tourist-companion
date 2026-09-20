import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminContent } from './admin-content';
import {
  contentListParams,
  showsAirport,
  showsSteps,
  splitLines,
  topicOptionsForKind,
  type ContentItem,
} from './content.service';

const faq: ContentItem = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'is-tap-water-safe',
  kind: 'faq',
  title: 'Is tap water safe to drink?',
  summary: 'Visitors usually drink bottled water.',
  body: 'Buy sealed bottles.',
  tags: ['water'],
  area: null,
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

describe('content helpers', () => {
  it('builds list filters and kind-specific fields', () => {
    expect(contentListParams().keys()).toEqual([]);
    expect(contentListParams('faq', 'published', 'water').get('kind')).toBe('faq');
    expect(contentListParams('faq', 'draft', 'water').get('published')).toBe('false');
    expect(topicOptionsForKind('safety').some((option) => option.id === 'scams')).toBeTrue();
    expect(topicOptionsForKind('faq')).toEqual([]);
    expect(showsAirport('arrival_guide')).toBeTrue();
    expect(showsSteps('safety')).toBeTrue();
    expect(splitLines('one\ntwo, three')).toEqual(['one', 'two', 'three']);
  });
});

describe('AdminContent', () => {
  let fixture: ComponentFixture<AdminContent>;
  let component: AdminContent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminContent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminContent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('lists content and filters by kind', () => {
    const req = http.expectOne(`${environment.apiBaseUrl}/admin/content`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ kinds: ['arrival_guide', 'faq', 'etiquette', 'payment', 'safety'], items: [faq] });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Content');
    expect(compiled.textContent).toContain('Is tap water safe to drink?');
    expect(compiled.querySelector('a.btn')?.getAttribute('href')).toBe('/admin/content/new');

    component.filterKind('faq');
    const filtered = http.expectOne(`${environment.apiBaseUrl}/admin/content?kind=faq`);
    filtered.flush({ kinds: ['faq'], kind: 'faq', items: [faq] });
  });

  it('publishes and deletes a row', () => {
    http.expectOne(`${environment.apiBaseUrl}/admin/content`).flush({ items: [faq] });
    fixture.detectChanges();

    component.togglePublished(faq);
    const publish = http.expectOne(`${environment.apiBaseUrl}/admin/content/${faq.id}/unpublish`);
    expect(publish.request.method).toBe('POST');
    publish.flush({ item: { ...faq, published: false } });
    expect(component.items()[0].published).toBeFalse();

    spyOn(window, 'confirm').and.returnValue(true);
    component.remove(faq);
    const deleted = http.expectOne(`${environment.apiBaseUrl}/admin/content/${faq.id}`);
    expect(deleted.request.method).toBe('DELETE');
    deleted.flush(null);
    expect(component.items()).toEqual([]);
  });
});
