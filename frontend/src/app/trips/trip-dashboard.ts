import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { concat, last } from 'rxjs';
import { PartnerListings } from '../partners/partner-listings';
import {
  PartnerService,
  TRIP_PARTNER_CATEGORIES,
  referralStatusLabel,
  type Referral,
} from '../partners/partner.service';
import {
  buildTimeline,
  findTempTimeSlot,
  formatPlanDate,
  formatTime12h,
  highlightCount,
  inclusiveDayCount,
  itineraryIsEmpty,
  localTodayIso,
  movedItemIds,
  neighborItem,
  nextActivityTimes,
  orderedDayItems,
  selectFeaturedTrip,
  selectPlanDayNumber,
  Trip,
  TripService,
  type Itinerary,
  type ItineraryDay,
  type ItineraryItem,
  type ItineraryItemKind,
  type SavedTripPlace,
} from './trip.service';

export {
  buildTimeline,
  findTempTimeSlot,
  formatPlanDate,
  formatTime12h,
  highlightCount,
  inclusiveDayCount,
  itineraryIsEmpty,
  localTodayIso,
  movedItemIds,
  neighborItem,
  nextActivityTimes,
  orderedDayItems,
  selectFeaturedTrip,
  selectPlanDayNumber,
} from './trip.service';

export const KIND_PILLS: { kind: ItineraryItemKind; label: string }[] = [
  { kind: 'activity', label: 'Activity' },
  { kind: 'meal', label: 'Meal' },
  { kind: 'travel', label: 'Travel' },
  { kind: 'note', label: 'Note' },
];

export function clockValue(value: string): string {
  return value.slice(0, 5);
}

@Component({
  selector: 'app-trip-dashboard',
  imports: [FormsModule, RouterLink, PartnerListings],
  templateUrl: './trip-dashboard.html',
  styleUrl: './trip-dashboard.css',
})
export class TripDashboard implements OnInit {
  private readonly tripsApi = inject(TripService);
  private readonly partnersApi = inject(PartnerService);

  readonly kinds = KIND_PILLS;
  readonly tripPartnerCategories = TRIP_PARTNER_CATEGORIES;
  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly featured = signal<Trip | null>(null);
  readonly featuredKind = signal<'current' | 'upcoming' | 'none'>('none');
  readonly dayCount = signal(0);
  readonly savedPlaces = signal<SavedTripPlace[]>([]);
  readonly savedError = signal('');
  readonly itinerary = signal<Itinerary | null>(null);
  readonly itineraryPending = signal(false);
  readonly itineraryError = signal('');
  readonly generating = signal(false);
  readonly selectedDayNumber = signal(1);
  readonly editBusy = signal(false);
  readonly editError = signal('');
  readonly editorOpen = signal(false);
  readonly editorMode = signal<'add' | 'replace'>('add');
  readonly referrals = signal<Referral[]>([]);

  draftKind: ItineraryItemKind = 'activity';
  draftTitle = '';
  draftStart = '09:30';
  draftEnd = '11:00';
  draftPlaceId = '';
  draftNotes = '';
  draftDayId = '';
  draftItemId: string | null = null;

  readonly selectedDay = computed<ItineraryDay | null>(() => {
    const plan = this.itinerary();
    const number = this.selectedDayNumber();
    return plan?.days.find((day) => day.dayNumber === number) ?? plan?.days[0] ?? null;
  });

  readonly timeline = computed(() => buildTimeline(this.selectedDay()?.items ?? [], this.savedPlaces()));
  readonly highlights = computed(() => highlightCount(this.selectedDay()));
  readonly planEmpty = computed(() => itineraryIsEmpty(this.itinerary()));

  ngOnInit(): void {
    this.load();
    this.loadReferrals();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.savedError.set('');
    this.itineraryError.set('');
    this.editError.set('');
    this.tripsApi.list().subscribe({
      next: ({ trips }) => {
        const today = localTodayIso();
        const trip = selectFeaturedTrip(trips, today);
        this.featured.set(trip);
        if (!trip) {
          this.featuredKind.set('none');
          this.dayCount.set(0);
          this.savedPlaces.set([]);
          this.itinerary.set(null);
          this.pending.set(false);
        } else if (trip.startDate <= today && today <= trip.endDate) {
          this.featuredKind.set('current');
          this.dayCount.set(inclusiveDayCount(trip.startDate, trip.endDate));
          this.loadSaved(trip.id);
          this.loadItinerary(trip.id);
          this.pending.set(false);
        } else {
          this.featuredKind.set('upcoming');
          this.dayCount.set(inclusiveDayCount(trip.startDate, trip.endDate));
          this.loadSaved(trip.id);
          this.loadItinerary(trip.id);
          this.pending.set(false);
        }
      },
      error: () => {
        this.pending.set(false);
        this.featured.set(null);
        this.featuredKind.set('none');
        this.savedPlaces.set([]);
        this.itinerary.set(null);
        this.loadError.set('Could not load your trips. Try again.');
      },
    });
  }

  selectDay(dayNumber: number): void {
    this.selectedDayNumber.set(dayNumber);
    this.closeEditor();
  }

  formatTime(hhmm: string): string {
    return formatTime12h(hhmm);
  }

  formatDate(isoDate: string): string {
    return formatPlanDate(isoDate);
  }

  itemTitle(item: ItineraryItem): string {
    return item.title?.trim() || 'Planned stop';
  }

  partnerIds(item: ItineraryItem): string[] {
    return item.referralPartnerId ? [item.referralPartnerId] : [];
  }

  referralLabel(row: Referral): string {
    return `${referralStatusLabel(row.status)} · ${row.referralCode}`;
  }

  canMove(item: ItineraryItem, direction: 'up' | 'down'): boolean {
    return neighborItem(this.selectedDay()?.items ?? [], item.id, direction) != null;
  }

  generate(scope: { dayId?: string; dayNumber?: number } = {}): void {
    const trip = this.featured();
    if (!trip) {
      return;
    }
    this.generating.set(true);
    this.itineraryError.set('');
    this.tripsApi.generateItinerary(trip.id, scope).subscribe({
      next: ({ itinerary }) => {
        this.applyItinerary(itinerary, true);
        this.generating.set(false);
      },
      error: () => {
        this.generating.set(false);
        this.itineraryError.set(
          scope.dayId || scope.dayNumber
            ? 'Could not regenerate that day. Try again.'
            : 'Could not generate a plan. Try again.',
        );
      },
    });
  }

  regenerateDay(): void {
    const day = this.selectedDay();
    if (!day) {
      return;
    }
    this.generate({ dayId: day.id, dayNumber: day.dayNumber });
  }

  toggleLock(item: ItineraryItem): void {
    const trip = this.featured();
    if (!trip) {
      return;
    }
    this.runEdit(
      this.tripsApi.updateItem(trip.id, item.id, { locked: !item.locked }),
      item.locked ? 'Could not unlock that stop.' : 'Could not lock that stop.',
      false,
    );
  }

  openAdd(): void {
    const day = this.selectedDay();
    if (!day) {
      return;
    }
    const times = nextActivityTimes(day.items);
    this.editorMode.set('add');
    this.draftItemId = null;
    this.draftDayId = day.id;
    this.draftKind = 'activity';
    this.draftTitle = '';
    this.draftStart = times.startTime;
    this.draftEnd = times.endTime;
    this.draftPlaceId = '';
    this.draftNotes = '';
    this.editorOpen.set(true);
    this.editError.set('');
  }

  openReplace(item: ItineraryItem): void {
    this.editorMode.set('replace');
    this.draftItemId = item.id;
    this.draftDayId = item.dayId;
    this.draftKind = item.kind;
    this.draftTitle = item.title ?? '';
    this.draftStart = item.startTime;
    this.draftEnd = item.endTime;
    this.draftPlaceId = item.placeId ?? '';
    this.draftNotes = item.notes ?? '';
    this.editorOpen.set(true);
    this.editError.set('');
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.draftItemId = null;
  }

  setDraftKind(kind: ItineraryItemKind): void {
    this.draftKind = kind;
  }

  setDraftPlace(placeId: string): void {
    this.draftPlaceId = placeId;
    const place = this.savedPlaces().find((entry) => entry.placeId === placeId);
    if (place && !this.draftTitle.trim()) {
      this.draftTitle = place.name;
    }
  }

  addSavedPlace(place: SavedTripPlace): void {
    const day = this.selectedDay();
    if (!day) {
      return;
    }
    this.openAdd();
    this.setDraftPlace(place.placeId);
    this.draftTitle = place.name;
  }

  saveEditor(): void {
    const trip = this.featured();
    const day = this.selectedDay();
    if (!trip || !day) {
      return;
    }
    const startTime = clockValue(this.draftStart);
    const endTime = clockValue(this.draftEnd);
    if (endTime <= startTime) {
      this.editError.set('End time must be after start time.');
      return;
    }
    const title = this.draftTitle.trim();
    if (!title && !this.draftPlaceId) {
      this.editError.set('Add a title or pick a saved place.');
      return;
    }
    const body = {
      kind: this.draftKind,
      startTime,
      endTime,
      title: title || null,
      placeId: this.draftPlaceId || null,
      notes: this.draftNotes.trim() || null,
    };
    if (this.editorMode() === 'add') {
      this.runEdit(
        this.tripsApi.createItem(trip.id, { ...body, dayId: this.draftDayId || day.id }),
        'Could not add that stop.',
        true,
      );
      return;
    }
    if (!this.draftItemId) {
      return;
    }
    this.runEdit(
      this.tripsApi.updateItem(trip.id, this.draftItemId, { ...body, dayId: this.draftDayId || day.id }),
      'Could not replace that stop.',
      true,
    );
  }

  removeItem(item: ItineraryItem): void {
    const trip = this.featured();
    if (!trip) {
      return;
    }
    this.runEdit(this.tripsApi.deleteItem(trip.id, item.id), 'Could not remove that stop.', item.id === this.draftItemId);
  }

  moveItem(item: ItineraryItem, direction: 'up' | 'down'): void {
    const trip = this.featured();
    const day = this.selectedDay();
    const neighbor = neighborItem(day?.items ?? [], item.id, direction);
    if (!trip || !day || !neighbor) {
      return;
    }
    const parked = findTempTimeSlot(day.items.filter((entry) => entry.id !== item.id));
    if (!parked) {
      this.editError.set('Could not move that stop. The day is fully booked.');
      return;
    }
    const original = { startTime: item.startTime, endTime: item.endTime };
    const swapped = { startTime: neighbor.startTime, endTime: neighbor.endTime };
    const orderedIds = orderedDayItems(day.items).map((entry) => entry.id);
    const nextIds = movedItemIds(orderedIds, item.id, direction);
    const steps = [
      this.tripsApi.updateItem(trip.id, item.id, parked),
      this.tripsApi.updateItem(trip.id, neighbor.id, original),
      this.tripsApi.updateItem(trip.id, item.id, swapped),
    ];
    if (nextIds) {
      steps.push(this.tripsApi.reorderItems(trip.id, day.id, nextIds));
    }
    this.editBusy.set(true);
    this.editError.set('');
    concat(...steps)
      .pipe(last())
      .subscribe({
        next: ({ itinerary }) => {
          this.applyItinerary(itinerary, true);
          this.editBusy.set(false);
        },
        error: () => {
          this.editBusy.set(false);
          this.editError.set('Could not move that stop.');
        },
      });
  }

  private loadSaved(tripId: string): void {
    this.tripsApi.listPlaces(tripId).subscribe({
      next: ({ places }) => this.savedPlaces.set(places),
      error: () => {
        this.savedPlaces.set([]);
        this.savedError.set('Could not load saved places.');
      },
    });
  }

  private loadItinerary(tripId: string): void {
    this.itineraryPending.set(true);
    this.tripsApi.getItinerary(tripId).subscribe({
      next: ({ itinerary }) => {
        if (!itineraryIsEmpty(itinerary)) {
          this.applyItinerary(itinerary);
          this.itineraryPending.set(false);
          return;
        }
        this.generating.set(true);
        this.tripsApi.generateItinerary(tripId).subscribe({
          next: ({ itinerary: generated }) => {
            this.applyItinerary(generated);
            this.itineraryPending.set(false);
            this.generating.set(false);
          },
          error: () => {
            this.applyItinerary(itinerary);
            this.itineraryPending.set(false);
            this.generating.set(false);
            this.itineraryError.set('Could not generate a plan. Try again.');
          },
        });
      },
      error: () => {
        this.itineraryPending.set(false);
        this.itinerary.set(null);
        this.itineraryError.set('Could not load your itinerary.');
      },
    });
  }

  private runEdit(
    request: ReturnType<TripService['createItem']>,
    failMessage: string,
    closeEditor: boolean,
  ): void {
    this.editBusy.set(true);
    this.editError.set('');
    request.subscribe({
      next: ({ itinerary }) => {
        this.applyItinerary(itinerary, true);
        this.editBusy.set(false);
        if (closeEditor) {
          this.closeEditor();
        }
      },
      error: () => {
        this.editBusy.set(false);
        this.editError.set(failMessage);
      },
    });
  }

  private applyItinerary(itinerary: Itinerary, keepDay = false): void {
    this.itinerary.set(itinerary);
    if (!keepDay) {
      this.selectedDayNumber.set(selectPlanDayNumber(itinerary, localTodayIso()));
    }
  }

  unsave(place: SavedTripPlace): void {
    this.tripsApi.removePlace(place.tripId, place.placeId).subscribe({
      next: () => {
        this.savedPlaces.set(this.savedPlaces().filter((item) => item.placeId !== place.placeId));
      },
      error: () => {
        this.savedError.set('Could not remove that saved place.');
      },
    });
  }

  private loadReferrals(): void {
    this.partnersApi.listReferrals().subscribe({
      next: (referrals) => this.referrals.set(referrals),
      error: () => this.referrals.set([]),
    });
  }
}
