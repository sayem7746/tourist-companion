import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CATEGORY_LABELS,
  EMERGENCY_CONTEXT_AREA,
  EMERGENCY_FILTER_CHIPS,
  EMERGENCY_LEDE,
  EmergencyService,
  FALLBACK_SOS,
  numberDisplay,
  telHref,
  URGENCY_LABELS,
  type EmergencyContact,
  type EmergencyDirectory,
  type EmergencyFilterId,
  type EmergencyNumber,
} from './emergency.service';

@Component({
  selector: 'app-emergency',
  imports: [RouterLink],
  templateUrl: './emergency.html',
  styleUrl: './emergency.css',
})
export class Emergency implements OnInit {
  private readonly api = inject(EmergencyService);

  readonly chips = EMERGENCY_FILTER_CHIPS;
  readonly lede = EMERGENCY_LEDE;
  readonly contextArea = EMERGENCY_CONTEXT_AREA;
  readonly fallbackSos = FALLBACK_SOS;
  readonly categoryLabels = CATEGORY_LABELS;
  readonly urgencyLabels = URGENCY_LABELS;

  filter: EmergencyFilterId = 'all';

  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly directory = signal<EmergencyDirectory | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.api.directory(this.filter).subscribe({
      next: (body) => {
        this.directory.set(body);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load emergency help. Try again.');
      },
    });
  }

  onFilter(id: EmergencyFilterId): void {
    if (this.filter === id) {
      return;
    }
    this.filter = id;
    this.load();
  }

  tel(code: string): string {
    return telHref(code);
  }

  shown(number: EmergencyNumber): string {
    return numberDisplay(number);
  }

  dialClass(contact: EmergencyContact): string {
    return contact.urgency === 'sos' ? 'dial dial-sos' : 'dial dial-assist';
  }
}
