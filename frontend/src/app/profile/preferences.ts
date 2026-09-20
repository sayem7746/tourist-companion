import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { type DailyBudget, type Trip, type TripInterest, TripService } from '../trips/trip.service';
import {
  type DietaryPreference,
  type MobilityNeed,
  ProfileService,
  type TravelStyle,
} from './profile.service';

export const LANGUAGE_OPTIONS = ['en', 'ms', 'zh', 'ta', 'en-US'] as const;
export const DIETARY_OPTIONS: DietaryPreference[] = [
  'vegetarian',
  'vegan',
  'halal',
  'kosher',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'pescatarian',
];
export const MOBILITY_OPTIONS: MobilityNeed[] = [
  'wheelchair',
  'limited_walking',
  'visual_impairment',
  'hearing_impairment',
];
export const STYLE_OPTIONS: TravelStyle[] = ['relaxed', 'balanced', 'packed'];
export const BUDGET_OPTIONS: DailyBudget[] = ['low', 'medium', 'high'];
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

const LANGUAGE_PATTERN = /^[A-Za-z]{2}(?:-[A-Za-z0-9]{2,8})*$/;

@Component({
  selector: 'app-preferences',
  imports: [FormsModule, RouterLink],
  templateUrl: './preferences.html',
  styleUrl: './preferences.css',
})
export class Preferences implements OnInit {
  private readonly profileApi = inject(ProfileService);
  private readonly tripsApi = inject(TripService);

  readonly languageOptions = LANGUAGE_OPTIONS;
  readonly dietaryOptions = DIETARY_OPTIONS;
  readonly mobilityOptions = MOBILITY_OPTIONS;
  readonly styleOptions = STYLE_OPTIONS;
  readonly budgetOptions = BUDGET_OPTIONS;
  readonly interestOptions = INTEREST_OPTIONS;

  displayName = '';
  language = 'en';
  dietaryPreferences: DietaryPreference[] = [];
  mobilityNeeds: MobilityNeed[] = [];
  travelStyle: TravelStyle | '' = '';
  trips: Trip[] = [];
  selectedTripId = '';
  interests: TripInterest[] = [];
  dailyBudget: DailyBudget | '' = '';

  readonly pending = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly saved = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.saved.set(false);
    forkJoin({
      profile: this.profileApi.get(),
      trips: this.tripsApi.list(),
    }).subscribe({
      next: ({ profile, trips }) => {
        this.applyProfile(profile.profile);
        this.trips = trips.trips;
        this.selectTrip(this.trips[0]?.id ?? '');
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load your preferences. Try again.');
      },
    });
  }

  selectTrip(id: string): void {
    this.selectedTripId = id;
    const trip = this.trips.find((item) => item.id === id);
    this.interests = trip ? [...trip.interests] : [];
    this.dailyBudget = trip?.dailyBudget ?? '';
  }

  toggleDietary(value: DietaryPreference): void {
    this.dietaryPreferences = toggleList(this.dietaryPreferences, value);
  }

  toggleMobility(value: MobilityNeed): void {
    this.mobilityNeeds = toggleList(this.mobilityNeeds, value);
  }

  toggleInterest(value: TripInterest): void {
    this.interests = toggleList(this.interests, value);
  }

  isDietarySelected(value: DietaryPreference): boolean {
    return this.dietaryPreferences.includes(value);
  }

  isMobilitySelected(value: MobilityNeed): boolean {
    return this.mobilityNeeds.includes(value);
  }

  isInterestSelected(value: TripInterest): boolean {
    return this.interests.includes(value);
  }

  save(): void {
    this.saveError.set('');
    this.saved.set(false);
    const language = this.language.trim();
    if (!this.displayName.trim()) {
      this.saveError.set('Enter a display name.');
      return;
    }
    if (!LANGUAGE_PATTERN.test(language) || language.length > 16) {
      this.saveError.set('Use a language tag such as en or en-US.');
      return;
    }
    if (this.selectedTripId && this.interests.length < 1) {
      this.saveError.set('Select at least one trip interest.');
      return;
    }

    this.saving.set(true);
    const profile$ = this.profileApi.patch({
      displayName: this.displayName.trim(),
      language,
      dietaryPreferences: this.dietaryPreferences,
      mobilityNeeds: this.mobilityNeeds,
      travelStyle: this.travelStyle || null,
    });

    const trip = this.trips.find((item) => item.id === this.selectedTripId);
    if (!trip) {
      profile$.subscribe({
        next: ({ profile }) => {
          this.applyProfile(profile);
          this.saving.set(false);
          this.saved.set(true);
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set('Could not save preferences. Try again.');
        },
      });
      return;
    }

    forkJoin({
      profile: profile$,
      trip: this.tripsApi.update(trip.id, {
        interests: this.interests,
        dailyBudget: this.dailyBudget || null,
        travelStyle: this.travelStyle || null,
      }),
    }).subscribe({
      next: ({ profile, trip: tripResponse }) => {
        this.applyProfile(profile.profile);
        const updated = tripResponse.trip;
        this.trips = this.trips.map((item) => (item.id === updated.id ? updated : item));
        this.selectTrip(updated.id);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Could not save preferences. Try again.');
      },
    });
  }

  private applyProfile(profile: {
    displayName: string;
    language: string;
    dietaryPreferences: DietaryPreference[];
    mobilityNeeds: MobilityNeed[];
    travelStyle: TravelStyle | null;
  }): void {
    this.displayName = profile.displayName;
    this.language = profile.language;
    this.dietaryPreferences = [...profile.dietaryPreferences];
    this.mobilityNeeds = [...profile.mobilityNeeds];
    this.travelStyle = profile.travelStyle ?? '';
  }
}

function toggleList<T>(items: T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}
