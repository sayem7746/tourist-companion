import { Component, Input, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  type ArrivalAirportCode,
  type ArrivalTransferRecommendation,
  ArrivalService,
  DEFAULT_ARRIVAL_AIRPORT,
} from './arrival.service';

@Component({
  selector: 'app-arrival-transfer-helper',
  imports: [FormsModule],
  templateUrl: './arrival-transfer-helper.html',
  styleUrl: './arrival-transfer-helper.css',
})
export class ArrivalTransferHelper {
  private readonly api = inject(ArrivalService);

  @Input() airport: ArrivalAirportCode = DEFAULT_ARRIVAL_AIRPORT;

  destination = '';
  readonly formError = signal('');
  readonly pending = signal(false);
  readonly loadError = signal('');
  readonly recommendation = signal<ArrivalTransferRecommendation | null>(null);

  recommend(): void {
    const query = this.destination.trim();
    if (query.length < 2) {
      this.formError.set('Enter a hotel or destination (at least 2 characters).');
      this.recommendation.set(null);
      return;
    }

    this.formError.set('');
    this.loadError.set('');
    this.pending.set(true);
    this.api.recommendTransfer(query, this.airport).subscribe({
      next: (body) => {
        this.recommendation.set(body);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.recommendation.set(null);
        this.loadError.set('Could not load hotel transfer recommendations. Try again.');
      },
    });
  }

  chipClass(recommended: boolean): string {
    return recommended ? 'chip chip-gold' : 'chip chip-primary';
  }
}
