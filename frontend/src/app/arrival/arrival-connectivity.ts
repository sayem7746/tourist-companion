import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AIRPORT_LABELS,
  ARRIVAL_AIRPORTS,
  type ArrivalAirportCode,
  type ArrivalConnectivityOption,
  type ArrivalConnectivityTip,
  ArrivalService,
  DEFAULT_ARRIVAL_AIRPORT,
} from './arrival.service';

@Component({
  selector: 'app-arrival-connectivity',
  imports: [FormsModule, RouterLink],
  templateUrl: './arrival-connectivity.html',
  styleUrl: './arrival-connectivity.css',
})
export class ArrivalConnectivity implements OnInit, OnChanges {
  private readonly api = inject(ArrivalService);

  @Input() airport: ArrivalAirportCode = DEFAULT_ARRIVAL_AIRPORT;
  @Input() embedded = false;

  readonly airports = ARRIVAL_AIRPORTS;
  readonly airportLabels = AIRPORT_LABELS;

  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly options = signal<ArrivalConnectivityOption[]>([]);
  readonly tips = signal<ArrivalConnectivityTip[]>([]);

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['airport'] && !changes['airport'].firstChange) {
      this.load();
    }
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.api.listConnectivity(this.airport).subscribe({
      next: (body) => {
        this.options.set(body.options);
        this.tips.set(body.tips);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.options.set([]);
        this.tips.set([]);
        this.loadError.set('Could not load the SIM and connectivity guide. Try again.');
      },
    });
  }

  onAirportChange(value: ArrivalAirportCode): void {
    this.airport = value;
    this.load();
  }

  chipClass(badge: string): string {
    const lower = badge.toLowerCase();
    if (lower.includes('free') || lower.includes('skip')) {
      return 'chip chip-gold';
    }
    return 'chip chip-primary';
  }
}
