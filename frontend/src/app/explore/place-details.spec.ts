import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { convertToParamMap } from '@angular/router';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { actionButtonClass, type PlaceDetails } from './explore.service';
import { PlaceDetailsPage } from './place-details';

function details(partial: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    id: 'my-attr-petronas',
    name: 'Petronas Twin Towers',
    category: 'attraction',
    nearbyCategory: 'attractions',
    city: 'Kuala Lumpur',
    country: 'MY',
    area: 'KLCC',
    address: 'Kuala Lumpur City Centre',
    description: 'The defining KL skyline.',
    latitude: 3.15785,
    longitude: 101.71165,
    distanceMeters: 80,
    walkMinutes: 1,
    openNow: true,
    badges: ['Landmark'],
    source: 'seed',
    phone: '+60 3-2331 8080',
    website: 'https://www.petronastwintowers.com.my/',
    bookingUrl: 'https://www.petronastwintowers.com.my/',
    bookingLabel: 'Book tickets',
    hoursSummary: 'Daily 9 am – 9 pm',
    hoursLines: ['Daily 9 am – 9 pm'],
    photos: [
      {
        url: 'https://commons.wikimedia.org/wiki/Special:FilePath/example.jpg',
        license: 'CC BY-SA 4.0',
        attribution: 'Wikimedia Commons — Petronas Twin Towers (Kuala Lumpur)',
      },
    ],
    actions: [
      { kind: 'directions', label: 'Directions', href: 'https://www.google.com/maps/dir/?api=1' },
      { kind: 'call', label: 'Call', href: 'tel:+60323318080' },
      { kind: 'website', label: 'Website', href: 'https://www.petronastwintowers.com.my/' },
      { kind: 'booking', label: 'Book tickets', href: 'https://www.petronastwintowers.com.my/' },
    ],
    ...partial,
  };
}

describe('PlaceDetailsPage', () => {
  let fixture: ComponentFixture<PlaceDetailsPage>;
  let http: HttpTestingController;

  async function setup(id: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [PlaceDetailsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlaceDetailsPage);
    http = TestBed.inject(HttpTestingController);
  }

  function compiled(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    http.verify();
  });

  it('styles directions as the primary pill action', async () => {
    await setup('my-attr-petronas');
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/places/my-attr-petronas`).flush(details());
    expect(actionButtonClass('directions')).toBe('btn');
    expect(actionButtonClass('call')).toBe('btn btn-secondary');
  });

  it('loads GET /places/:id and paints Tropical Sanctuary detail cards', async () => {
    await setup('my-attr-petronas');
    fixture.detectChanges();

    const req = http.expectOne(`${environment.apiBaseUrl}/places/my-attr-petronas`);
    expect(req.request.method).toBe('GET');
    req.flush(details());
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/partners`).flush({ partners: [] });
    fixture.detectChanges();

    const text = compiled().textContent ?? '';
    expect(compiled().querySelector('h1')?.textContent).toContain('Petronas Twin Towers');
    expect(text).toContain('Kuala Lumpur City Centre');
    expect(text).toContain('+60 3-2331 8080');
    expect(text).toContain('Daily 9 am – 9 pm');
    expect(text).toContain('CC BY-SA 4.0');
    expect(text).toContain('Wikimedia Commons');
    expect(compiled().querySelector('[data-action="directions"]')?.textContent).toContain('Directions');
    expect(compiled().querySelector('[data-action="booking"]')?.textContent).toContain('Book tickets');
    const ratio = getComputedStyle(compiled().querySelector('.place-media')!).aspectRatio;
    expect(ratio === '16 / 10' || ratio === '1.6').toBeTrue();
  });

  it('shows a not-found state for 404', async () => {
    await setup('missing');
    fixture.detectChanges();
    http
      .expectOne(`${environment.apiBaseUrl}/places/missing`)
      .flush({ error: { message: 'Place not found' } }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(compiled().textContent).toContain('This place is not available');
  });
});
