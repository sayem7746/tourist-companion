import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  type DailyBudget,
  type TravelStyle,
  type TripInterest,
  TripService,
} from './trip.service';

export const DEFAULT_DESTINATIONS = [
  'Kuala Lumpur',
  'Penang',
  'Langkawi',
  'Malacca',
  'Kota Kinabalu',
  'Johor Bahru',
  'Cameron Highlands',
  'Other',
] as const;

export const INTEREST_OPTIONS: TripInterest[] = [
  'food',
  'nature',
  'culture',
  'shopping',
  'nightlife',
  'family',
  'adventure',
  'wellness',
];

export const BUDGET_OPTIONS: DailyBudget[] = ['low', 'medium', 'high'];
export const STYLE_OPTIONS: TravelStyle[] = ['relaxed', 'balanced', 'packed'];

@Component({
  selector: 'app-trip-onboarding',
  imports: [FormsModule, RouterLink],
  templateUrl: './trip-onboarding.html',
  styleUrl: './trip-onboarding.css',
})
export class TripOnboarding {
  private readonly trips = inject(TripService);
  private readonly router = inject(Router);

  readonly destinations = DEFAULT_DESTINATIONS;
  readonly interestOptions = INTEREST_OPTIONS;
  readonly budgetOptions = BUDGET_OPTIONS;
  readonly styleOptions = STYLE_OPTIONS;
  readonly totalSteps = 6;

  readonly step = signal(1);
  destinationPreset = '';
  customCity = '';
  startDate = '';
  endDate = '';
  adultCount = 1;
  childCount = 0;
  interests: TripInterest[] = [];
  dailyBudget: DailyBudget | '' = '';
  travelStyle: TravelStyle | '' = '';

  readonly fieldError = signal('');
  readonly submitError = signal('');
  readonly pending = signal(false);
  readonly createdTripId = signal('');

  destinationValue(): string {
    if (this.destinationPreset === 'Other') {
      return this.customCity.trim();
    }
    return this.destinationPreset.trim();
  }

  next(): void {
    this.fieldError.set('');
    if (!this.stepIsValid(this.step())) {
      this.fieldError.set(this.stepError(this.step()));
      return;
    }
    if (this.step() < this.totalSteps) {
      this.step.update((n) => n + 1);
    }
  }

  back(): void {
    this.fieldError.set('');
    this.submitError.set('');
    if (this.step() > 1) {
      this.step.update((n) => n - 1);
    }
  }

  toggleInterest(interest: TripInterest): void {
    if (this.interests.includes(interest)) {
      this.interests = this.interests.filter((item) => item !== interest);
    } else {
      this.interests = [...this.interests, interest];
    }
  }

  isInterestSelected(interest: TripInterest): boolean {
    return this.interests.includes(interest);
  }

  stepIsValid(step: number): boolean {
    switch (step) {
      case 1:
        return this.destinationValue().length > 0;
      case 2:
        return Boolean(this.startDate && this.endDate && this.endDate > this.startDate);
      case 3: {
        const adults = Number(this.adultCount);
        const children = Number(this.childCount);
        return Number.isInteger(adults) && adults >= 1 && Number.isInteger(children) && children >= 0;
      }
      case 4:
        return this.interests.length >= 1;
      case 5:
        return (
          (this.dailyBudget === '' || BUDGET_OPTIONS.includes(this.dailyBudget)) &&
          (this.travelStyle === '' || STYLE_OPTIONS.includes(this.travelStyle))
        );
      case 6:
        return [1, 2, 3, 4, 5].every((n) => this.stepIsValid(n));
      default:
        return false;
    }
  }

  createTrip(): void {
    this.submitError.set('');
    this.fieldError.set('');
    if (!this.stepIsValid(6)) {
      this.fieldError.set(this.stepError(6));
      return;
    }
    this.pending.set(true);
    this.trips
      .create({
        destination: this.destinationValue(),
        startDate: this.startDate,
        endDate: this.endDate,
        adultCount: Number(this.adultCount),
        childCount: Number(this.childCount),
        interests: this.interests,
        dailyBudget: this.dailyBudget || null,
        travelStyle: this.travelStyle || null,
      })
      .subscribe({
        next: ({ trip }) => {
          this.pending.set(false);
          this.createdTripId.set(trip.id);
          void this.router.navigateByUrl('/');
        },
        error: () => {
          this.pending.set(false);
          this.submitError.set('Could not create this trip. Try again.');
        },
      });
  }

  private stepError(step: number): string {
    switch (step) {
      case 1:
        return 'Choose a destination or type a city.';
      case 2:
        return 'Pick arrival and departure dates. Departure must be after arrival.';
      case 3:
        return 'Add at least one adult traveler.';
      case 4:
        return 'Select at least one interest.';
      default:
        return 'Check your trip details before creating.';
    }
  }
}
