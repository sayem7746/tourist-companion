import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrivalTransferHelper } from './arrival-transfer-helper';
import { PartnerListings } from '../partners/partner-listings';
import type { PartnerCategory } from '../partners/partner.service';
import {
  AIRPORT_LABELS,
  ARRIVAL_AIRPORTS,
  type ArrivalAirportCode,
  type ArrivalTransportOption,
  ArrivalService,
  DEFAULT_ARRIVAL_AIRPORT,
} from './arrival.service';

@Component({
  selector: 'app-arrival-transport',
  imports: [FormsModule, RouterLink, ArrivalTransferHelper, PartnerListings],
  templateUrl: './arrival-transport.html',
  styleUrl: './arrival-transport.css',
})
export class ArrivalTransport implements OnInit, OnChanges {
  private readonly api = inject(ArrivalService);

  @Input() airport: ArrivalAirportCode = DEFAULT_ARRIVAL_AIRPORT;
  @Input() embedded = false;

  readonly airports = ARRIVAL_AIRPORTS;
  readonly airportLabels = AIRPORT_LABELS;
  readonly transferCategories: PartnerCategory[] = ['transfers'];

  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly options = signal<ArrivalTransportOption[]>([]);

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
    this.api.listTransport(this.airport).subscribe({
      next: (body) => {
        this.options.set(body.options);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.options.set([]);
        this.loadError.set('Could not load the airport transport guide. Try again.');
      },
    });
  }

  onAirportChange(value: ArrivalAirportCode): void {
    this.airport = value;
    this.load();
  }

  chipClass(badge: string): string {
    const lower = badge.toLowerCase();
    if (lower.includes('fast') || lower.includes('meet')) {
      return 'chip chip-gold';
    }
    return 'chip chip-primary';
  }

  modeIcon(mode: ArrivalTransportOption['mode']): string {
    if (mode === 'ekspres') {
      return 'train';
    }
    if (mode === 'bus') {
      return 'directions_bus';
    }
    if (mode === 'e_hail') {
      return 'local_taxi';
    }
    return 'airport_shuttle';
  }
}
