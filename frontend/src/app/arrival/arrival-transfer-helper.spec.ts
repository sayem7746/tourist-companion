import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { ArrivalTransferHelper } from './arrival-transfer-helper';
import type { ArrivalTransferRecommendation } from './arrival.service';

function recommendation(): ArrivalTransferRecommendation {
  return {
    airportCode: 'KUL',
    destination: 'Mandarin Oriental',
    destinationLabel: 'KLCC',
    areaId: 'klcc',
    railFriendly: true,
    summary: 'KLIA Ekspres or the airport bus to KL Sentral, then a short hop to KLCC.',
    options: [
      {
        id: 'kul-opt-ekspres',
        mode: 'ekspres',
        name: 'KLIA Ekspres',
        badge: 'Recommended',
        recommended: true,
        reason: 'Good match for KLCC',
        estimatedCost: '~RM 55 per adult',
        estimatedDuration: '28 mins',
        frequency: 'Every 15–20 min',
        lastMile: 'LRT/Monorail or about 15–20 minutes by Grab from KL Sentral.',
        boarding: 'KLIA (main) Level 1 station.',
      },
      {
        id: 'kul-opt-e-hail',
        mode: 'e_hail',
        name: 'Grab / taxi',
        badge: 'Door-to-door',
        recommended: false,
        reason: 'Direct drop-off at KLCC',
        estimatedCost: '~RM 65–85 + ~RM 8 toll',
        estimatedDuration: '50–65 mins',
        boarding: 'KLIA Level 1 Doors 3 & 4',
      },
    ],
  };
}

describe('ArrivalTransferHelper', () => {
  let fixture: ComponentFixture<ArrivalTransferHelper>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArrivalTransferHelper],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ArrivalTransferHelper);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('asks for a hotel before calling the API', () => {
    fixture.detectChanges();
    fixture.componentInstance.recommend();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Enter a hotel or destination');
  });

  it('loads recommended modes with time and cost estimates', () => {
    fixture.detectChanges();
    fixture.componentInstance.destination = 'Mandarin Oriental';
    fixture.componentInstance.recommend();

    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-transfer`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('airport')).toBe('KUL');
    expect(req.request.params.get('destination')).toBe('Mandarin Oriental');
    req.flush(recommendation());
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('KLIA Ekspres or the airport bus');
    expect(text).toContain('KLIA Ekspres');
    expect(text).toContain('Recommended');
    expect(text).toContain('~RM 55 per adult');
    expect(text).toContain('28 mins');
    expect(text).toContain('Grab / taxi');
    expect(text).toContain('50–65 mins');
  });

  it('uses a 52px rounded search field', () => {
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('.search-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(getComputedStyle(input).height).toBe('52px');
    expect(getComputedStyle(input).borderRadius).toBe('999px');
  });

  it('shows an error when recommendations fail', () => {
    fixture.detectChanges();
    fixture.componentInstance.destination = 'KLCC';
    fixture.componentInstance.recommend();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-transfer`)
      .flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Could not load hotel transfer recommendations',
    );
  });
});
