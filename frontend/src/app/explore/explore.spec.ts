import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { Explore } from './explore';
import {
  BOOKMARK_GOLD,
  directionsUrl,
  EXPLORE_SEARCH_HEIGHT_PX,
  EXPLORE_SEARCH_PLACEHOLDER,
  formatDistance,
  nearbyHttpParams,
  openingStatus,
  SOS_COLOR,
  type NearbyPlace,
  type NearbySearchResult,
} from './explore.service';
import { Router } from '@angular/router';

function place(partial: Partial<NearbyPlace> & Pick<NearbyPlace, 'id' | 'name'>): NearbyPlace {
  return {
    category: 'food',
    nearbyCategory: 'food',
    city: 'Kuala Lumpur',
    country: 'MY',
    area: 'KLCC',
    address: 'Suria KLCC',
    description: 'Malaysian classics.',
    latitude: 3.15795,
    longitude: 101.71205,
    distanceMeters: 450,
    walkMinutes: 6,
    openNow: true,
    halal: true,
    badges: ['Halal', 'Kid Favorite'],
    priceBandMyr: 'RM 35–70',
    source: 'seed',
    ...partial,
  };
}

function body(places: NearbyPlace[], extra: Partial<NearbySearchResult> = {}): NearbySearchResult {
  return {
    provider: 'seed',
    fallback: false,
    origin: { latitude: 3.158, longitude: 101.712 },
    areaId: 'klcc',
    areaLabel: 'KLCC & Downtown',
    radiusMeters: 2000,
    category: 'all',
    q: null,
    quickFilters: [],
    chips: [
      { id: 'all', label: 'All', icon: '' },
      { id: 'food', label: 'Food & Halal', icon: 'restaurant' },
      { id: 'attractions', label: 'Must-See Sights', icon: 'photo_camera' },
    ],
    counts: { all: places.length, food: places.filter((item) => item.nearbyCategory === 'food').length },
    places,
    ...extra,
  };
}

describe('nearby helpers', () => {
  it('builds GET /places/nearby query params', () => {
    const params = nearbyHttpParams({
      category: 'food',
      q: 'atm',
      area: 'klcc',
      openNow: true,
      walk15: true,
    });
    expect(params.get('category')).toBe('food');
    expect(params.get('q')).toBe('atm');
    expect(params.get('area')).toBe('klcc');
    expect(params.get('openNow')).toBe('true');
    expect(params.get('walk15')).toBe('true');
    expect(params.get('halalOnly')).toBeNull();
  });

  it('omits q until two characters', () => {
    expect(nearbyHttpParams({ q: 'a' }).get('q')).toBeNull();
  });

  it('formats walking distance and opening status', () => {
    expect(formatDistance({ distanceMeters: 450, walkMinutes: 6 })).toBe('450m • 6 min walk');
    expect(formatDistance({ distanceMeters: 11000, walkMinutes: 140 })).toBe('11 km');
    expect(openingStatus({ openNow: true })).toBe('Open now');
    expect(openingStatus({ openNow: false })).toBe('Closed');
    expect(openingStatus({ openNow: null })).toBeNull();
  });

  it('builds a Google Maps directions URL', () => {
    const href = directionsUrl({ latitude: 3.15, longitude: 101.71 });
    expect(href).toContain('https://www.google.com/maps/dir/?');
    expect(href).toContain('destination=3.15%2C101.71');
  });
});

describe('Explore', () => {
  let fixture: ComponentFixture<Explore>;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Explore],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Explore);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
  });

  function compiled(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function flushNearby(
    payload: NearbySearchResult,
    expected?: Record<string, string | null>,
    session: 'anon' | 'skip' = 'anon',
  ): void {
    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/places/nearby`);
    expect(req.request.method).toBe('GET');
    if (expected) {
      for (const [key, value] of Object.entries(expected)) {
        expect(req.request.params.get(key)).toBe(value);
      }
    }
    req.flush(payload);
    for (const partnerReq of http.match(`${environment.apiBaseUrl}/partners`)) {
      expect(partnerReq.request.method).toBe('GET');
      partnerReq.flush({ partners: [] });
    }
    if (session === 'anon') {
      for (const tripReq of http.match(`${environment.apiBaseUrl}/trips`)) {
        expect(tripReq.request.withCredentials).toBeTrue();
        tripReq.flush({ error: { code: 'UNAUTHORIZED' } }, { status: 401, statusText: 'Unauthorized' });
      }
    }
    fixture.detectChanges();
  }

  it('renders the Stitch Explore chrome, 52px search, chips, and SOS', () => {
    fixture.detectChanges();
    flushNearby(
      body([
        place({ id: 'my-food-madam-kwan', name: 'Madam Kwan’s (Suria KLCC)' }),
        place({
          id: 'my-attr-petronas',
          name: 'Petronas Twin Towers',
          nearbyCategory: 'attractions',
          category: 'attraction',
          distanceMeters: 520,
          walkMinutes: 7,
        }),
      ]),
    );

    const text = compiled().textContent ?? '';
    expect(compiled().querySelector('h1')?.textContent).toContain('Explore & Nearby Helper');
    expect(text).toContain('KLCC & Downtown');
    expect(text).toContain('Food & Halal');
    expect(text).toContain('Must-See Sights');
    expect(text).toContain('Open Now');
    expect(text).toContain('Halal Only');
    expect(text).toContain('≤ 15 min walk');
    expect(text).toContain('Radar active');

    const search = compiled().querySelector('#exploreSearchInput') as HTMLInputElement;
    expect(search.placeholder).toBe(EXPLORE_SEARCH_PLACEHOLDER);
    expect(search.style.height).toBe(`${EXPLORE_SEARCH_HEIGHT_PX}px`);
    expect(EXPLORE_SEARCH_HEIGHT_PX).toBe(52);

    const sos = compiled().querySelector('.sos-btn') as HTMLElement;
    expect(sos.getAttribute('data-path')).toBe('emergency-help');
    expect(sos.textContent).toContain('SOS');
    expect(SOS_COLOR).toBe('#E11D48');
  });

  it('loads GET /places/nearby for the default KLCC area and paints cards', () => {
    fixture.detectChanges();
    flushNearby(
      body([
        place({
          id: 'my-food-madam-kwan',
          name: 'Madam Kwan’s (Suria KLCC)',
        }),
      ]),
      { area: 'klcc', category: null, q: null },
    );

    expect(compiled().textContent).toContain('Madam Kwan’s (Suria KLCC)');
    expect(compiled().textContent).toContain('450m • 6 min walk');
    expect(compiled().textContent).toContain('Open now');
    expect(compiled().querySelector('.distance-pill')?.textContent).toContain('450m');
    expect(compiled().querySelector('.place-media')).toBeTruthy();
    const ratio = getComputedStyle(compiled().querySelector('.place-media')!).aspectRatio;
    expect(ratio === '16 / 10' || ratio === '1.6').toBeTrue();
    expect(compiled().querySelector('.bookmark')?.getAttribute('aria-label')).toBe('Bookmark');
    const directions = compiled().querySelector('.place-actions a.btn') as HTMLAnchorElement;
    expect(directions.textContent).toContain('Directions');
    expect(directions.getAttribute('href')).toContain('google.com/maps/dir');
    const details = Array.from(compiled().querySelectorAll('.place-actions a')).find((el) =>
      el.textContent?.includes('Details'),
    ) as HTMLAnchorElement;
    expect(details.getAttribute('href')).toContain('/explore/my-food-madam-kwan');
  });

  it('filters by category chip', () => {
    fixture.detectChanges();
    flushNearby(body([place({ id: 'a', name: 'First' })]));

    const food = compiled().querySelector('[data-category="food"]') as HTMLButtonElement;
    food.click();
    fixture.detectChanges();
    flushNearby(body([place({ id: 'food-1', name: 'Nasi lemak' })], { category: 'food' }), {
      category: 'food',
      area: 'klcc',
    });
    expect(compiled().textContent).toContain('Nasi lemak');
  });

  it('toggles quick filters and list/map view', () => {
    fixture.detectChanges();
    flushNearby(body([place({ id: 'a', name: 'First' })]));

    const openNow = compiled().querySelector('[data-quick="open_now"]') as HTMLButtonElement;
    openNow.click();
    fixture.detectChanges();
    flushNearby(body([place({ id: 'a', name: 'First' })], { quickFilters: ['open_now'] }), {
      openNow: 'true',
      area: 'klcc',
    });
    expect(openNow.getAttribute('aria-pressed')).toBe('true');

    const mapBtn = Array.from(compiled().querySelectorAll('.view-toggle button')).find((el) =>
      el.textContent?.includes('Map'),
    ) as HTMLButtonElement;
    mapBtn.click();
    fixture.detectChanges();
    expect(compiled().querySelector('.mini-map')?.classList.contains('expanded')).toBeTrue();
    expect(compiled().querySelector('.mini-map')?.getAttribute('data-view')).toBe('map');
  });

  it('debounces search into GET /places/nearby?q=', fakeAsync(() => {
    fixture.detectChanges();
    flushNearby(body([place({ id: 'a', name: 'First' })]));

    fixture.componentInstance.onSearchInput('atm');
    tick(250);
    fixture.detectChanges();
    flushNearby(body([place({ id: 'atm-1', name: 'Maybank ATM', nearbyCategory: 'atm', category: 'other' })]), {
      q: 'atm',
      area: 'klcc',
    });
    expect(compiled().textContent).toContain('Maybank ATM');
  }));

  it('shows a retry state when nearby fails', () => {
    fixture.detectChanges();
    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/places/nearby`);
    req.flush({ error: 'fail' }, { status: 500, statusText: 'Server Error' });
    const tripsReq = http.expectOne(`${environment.apiBaseUrl}/trips`);
    tripsReq.flush({ error: { code: 'UNAUTHORIZED' } }, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${environment.apiBaseUrl}/partners`).flush({ partners: [] });
    fixture.detectChanges();
    expect(compiled().textContent).toContain('Could not load nearby places');
  });

  it('sends anonymous users to sign in when they bookmark a place', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    flushNearby(body([place({ id: 'my-food-madam-kwan', name: 'Madam Kwan’s (Suria KLCC)' })]));

    (compiled().querySelector('.bookmark') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/explore' } });
    expect(BOOKMARK_GOLD).toBe('#D97706');
  });

  it('saves and unsaves a place on the current trip with gold bookmark', () => {
    fixture.detectChanges();
    flushNearby(body([place({ id: 'my-food-madam-kwan', name: 'Madam Kwan’s (Suria KLCC)' })]), undefined, 'skip');

    const tripsReq = http.expectOne(`${environment.apiBaseUrl}/trips`);
    expect(tripsReq.request.withCredentials).toBeTrue();
    tripsReq.flush({
      trips: [
        {
          id: 'trip-1',
          userId: 'user-1',
          destination: 'Kuala Lumpur',
          startDate: '2020-01-01',
          endDate: '2099-12-31',
          adultCount: 1,
          childCount: 0,
          interests: ['food'],
          dailyBudget: 'medium',
          travelStyle: 'balanced',
        },
      ],
    });
    const savedReq = http.expectOne(`${environment.apiBaseUrl}/trips/trip-1/places`);
    expect(savedReq.request.method).toBe('GET');
    expect(savedReq.request.withCredentials).toBeTrue();
    savedReq.flush({ places: [] });
    fixture.detectChanges();

    const bookmark = compiled().querySelector('.bookmark') as HTMLButtonElement;
    bookmark.click();
    fixture.detectChanges();
    const post = http.expectOne(`${environment.apiBaseUrl}/trips/trip-1/places`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ placeId: 'my-food-madam-kwan' });
    expect(post.request.withCredentials).toBeTrue();
    post.flush({
      place: {
        tripId: 'trip-1',
        placeId: 'my-food-madam-kwan',
        catalogId: 'cat-1',
        name: 'Madam Kwan’s (Suria KLCC)',
        category: 'food',
        city: 'Kuala Lumpur',
        address: null,
        latitude: 3.15,
        longitude: 101.71,
        notes: null,
        sortOrder: 0,
      },
    });
    fixture.detectChanges();

    expect(bookmark.getAttribute('aria-pressed')).toBe('true');
    expect(bookmark.getAttribute('aria-label')).toBe('Remove bookmark');
    expect(bookmark.classList.contains('on')).toBeTrue();
    expect(bookmark.style.color.replace(/\s/g, '').toLowerCase()).toMatch(/#d97706|rgb\(217,119,6\)/);
    expect(BOOKMARK_GOLD).toBe('#D97706');

    bookmark.click();
    fixture.detectChanges();
    const del = http.expectOne(`${environment.apiBaseUrl}/trips/trip-1/places/my-food-madam-kwan`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    fixture.detectChanges();
    expect(compiled().querySelector('.bookmark')?.getAttribute('aria-pressed')).toBe('false');
  });
});
