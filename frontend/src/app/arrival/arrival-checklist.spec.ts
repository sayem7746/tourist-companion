import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { ArrivalChecklist } from './arrival-checklist';
import { progressPercent, progressStorageKey } from './arrival-progress';
import type { ArrivalChecklistItem, ArrivalChecklistResponse } from './arrival.service';

function item(partial: Partial<ArrivalChecklistItem> & Pick<ArrivalChecklistItem, 'id' | 'title'>): ArrivalChecklistItem {
  return {
    airportCode: 'KUL',
    stage: 'immigration',
    body: 'Do this after landing.',
    sortOrder: 1,
    estimatedMinutes: 10,
    ...partial,
  };
}

function body(items: ArrivalChecklistItem[], extra: Partial<ArrivalChecklistResponse> = {}): ArrivalChecklistResponse {
  return {
    airportCode: 'KUL',
    stage: null,
    stages: ['immigration', 'baggage', 'customs', 'sim', 'money', 'transport', 'first_steps'],
    items,
    ...extra,
  };
}

describe('arrival progress helpers', () => {
  it('rounds percent complete', () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(1, 4)).toBe(25);
  });
});

describe('ArrivalChecklist', () => {
  let fixture: ComponentFixture<ArrivalChecklist>;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ArrivalChecklist],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ArrivalChecklist);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('loads GET /arrival-checklist with default KUL airport', () => {
    fixture.detectChanges();
    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-checklist`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('airport')).toBe('KUL');
    expect(req.request.params.get('stage')).toBeNull();

    req.flush(
      body([
        item({ id: 'kul-immigration-mdac', title: 'Complete MDAC before passport control', stage: 'immigration' }),
        item({ id: 'kul-baggage-carousel', title: 'Collect bags at the KLIA carousel', stage: 'baggage', sortOrder: 1 }),
      ]),
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Arrival checklist');
    expect(compiled.textContent).toContain('Complete MDAC before passport control');
    expect(compiled.textContent).toContain('Collect bags at the KLIA carousel');
    expect(compiled.textContent).toContain('0 of 2 steps done (0%)');
    expect(compiled.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
  });

  it('filters by airport and stage', () => {
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-checklist`)
      .flush(body([item({ id: 'a', title: 'First' })]));
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.onAirportChange('KLIA2');
    const airportReq = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-checklist`);
    expect(airportReq.request.params.get('airport')).toBe('KLIA2');
    airportReq.flush(
      body([item({ id: 'klia2-sim', title: 'SIM in Gateway', airportCode: 'KLIA2', stage: 'sim' })], {
        airportCode: 'KLIA2',
      }),
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('SIM in Gateway');

    component.onStageChange('sim');
    const stageReq = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-checklist`);
    expect(stageReq.request.params.get('airport')).toBe('KLIA2');
    expect(stageReq.request.params.get('stage')).toBe('sim');
    stageReq.flush(
      body([item({ id: 'klia2-sim', title: 'SIM in Gateway', airportCode: 'KLIA2', stage: 'sim' })], {
        airportCode: 'KLIA2',
        stage: 'sim',
      }),
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('0 of 1 steps done (0%)');
  });

  it('tracks progress locally and restores it', () => {
    fixture.detectChanges();
    http.expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-checklist`).flush(
      body([item({ id: 'kul-immigration-mdac', title: 'Complete MDAC before passport control' })]),
    );
    fixture.detectChanges();

    fixture.componentInstance.toggleDone('kul-immigration-mdac');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 of 1 steps done (100%)');
    expect(JSON.parse(localStorage.getItem(progressStorageKey('KUL')) ?? '[]')).toEqual(['kul-immigration-mdac']);
  });

  it('shows an error when GET /arrival-checklist fails', () => {
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/arrival-checklist`)
      .flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not load the arrival checklist');
  });
});
