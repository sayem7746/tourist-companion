import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AIRPORT_LABELS,
  ARRIVAL_AIRPORTS,
  type ArrivalAirportCode,
  type ArrivalPaymentOption,
  type ArrivalPaymentTip,
  ArrivalService,
  DEFAULT_ARRIVAL_AIRPORT,
} from './arrival.service';

@Component({
  selector: 'app-arrival-currency',
  imports: [FormsModule, RouterLink],
  templateUrl: './arrival-currency.html',
  styleUrl: './arrival-currency.css',
})
export class ArrivalCurrency implements OnInit, OnChanges {
  private readonly api = inject(ArrivalService);

  @Input() airport: ArrivalAirportCode = DEFAULT_ARRIVAL_AIRPORT;
  @Input() embedded = false;

  readonly airports = ARRIVAL_AIRPORTS;
  readonly airportLabels = AIRPORT_LABELS;

  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly options = signal<ArrivalPaymentOption[]>([]);
  readonly tips = signal<ArrivalPaymentTip[]>([]);

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
    this.api.listCurrency(this.airport).subscribe({
      next: (body) => {
        this.options.set(body.options);
        this.tips.set(body.tips);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.options.set([]);
        this.tips.set([]);
        this.loadError.set('Could not load the currency and payment guide. Try again.');
      },
    });
  }

  onAirportChange(value: ArrivalAirportCode): void {
    this.airport = value;
    this.load();
  }

  chipClass(badge: string): string {
    const upper = badge.toUpperCase();
    if (upper === 'MYR' || upper === 'CASH') {
      return 'chip chip-gold';
    }
    return 'chip chip-primary';
  }
}
