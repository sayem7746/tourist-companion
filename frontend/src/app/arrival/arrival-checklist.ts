import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AIRPORT_LABELS,
  ARRIVAL_AIRPORTS,
  ARRIVAL_STAGES,
  type ArrivalAirportCode,
  type ArrivalChecklistItem,
  type ArrivalStage,
  ArrivalService,
  DEFAULT_ARRIVAL_AIRPORT,
  STAGE_LABELS,
} from './arrival.service';
import { loadDoneIds, progressPercent, saveDoneIds } from './arrival-progress';

@Component({
  selector: 'app-arrival-checklist',
  imports: [FormsModule, RouterLink],
  templateUrl: './arrival-checklist.html',
  styleUrl: './arrival-checklist.css',
})
export class ArrivalChecklist implements OnInit {
  private readonly api = inject(ArrivalService);

  readonly airports = ARRIVAL_AIRPORTS;
  readonly stages = ARRIVAL_STAGES;
  readonly airportLabels = AIRPORT_LABELS;
  readonly stageLabels = STAGE_LABELS;

  airport: ArrivalAirportCode = DEFAULT_ARRIVAL_AIRPORT;
  stageFilter: ArrivalStage | '' = '';

  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly items = signal<ArrivalChecklistItem[]>([]);
  readonly doneIds = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.api.list(this.airport, this.stageFilter).subscribe({
      next: (body) => {
        this.items.set(body.items);
        this.doneIds.set(loadDoneIds(this.airport));
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.items.set([]);
        this.loadError.set('Could not load the arrival checklist. Try again.');
      },
    });
  }

  onAirportChange(value: ArrivalAirportCode): void {
    this.airport = value;
    this.load();
  }

  onStageChange(value: ArrivalStage | ''): void {
    this.stageFilter = value;
    this.load();
  }

  isDone(id: string): boolean {
    return this.doneIds().has(id);
  }

  toggleDone(id: string): void {
    const next = new Set(this.doneIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.doneIds.set(next);
    saveDoneIds(this.airport, next);
  }

  doneCount(): number {
    return this.items().filter((item) => this.doneIds().has(item.id)).length;
  }

  percent(): number {
    return progressPercent(this.doneCount(), this.items().length);
  }

  groupedStages(): ArrivalStage[] {
    const present = new Set(this.items().map((item) => item.stage));
    return ARRIVAL_STAGES.filter((stage) => present.has(stage));
  }

  itemsForStage(stage: ArrivalStage): ArrivalChecklistItem[] {
    return this.items().filter((item) => item.stage === stage);
  }
}
