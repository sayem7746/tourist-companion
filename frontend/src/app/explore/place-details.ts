import { Component, computed, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PartnerListings } from '../partners/partner-listings';
import { placePartnerCategories } from '../partners/partner.service';
import {
  actionButtonClass,
  coverTone,
  formatDistance,
  openingStatus,
  type PlaceDetails,
  type PlaceExternalAction,
  ExploreService,
} from './explore.service';

@Component({
  selector: 'app-place-details',
  imports: [RouterLink, PartnerListings],
  templateUrl: './place-details.html',
  styleUrl: './place-details.css',
})
export class PlaceDetailsPage implements OnInit {
  private readonly api = inject(ExploreService);
  private readonly route = inject(ActivatedRoute);

  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly notFound = signal(false);
  readonly place = signal<PlaceDetails | null>(null);
  readonly partnerCategories = computed(() => {
    const venue = this.place();
    return venue ? placePartnerCategories(venue.nearbyCategory) : [];
  });

  ngOnInit(): void {
    this.load();
  }

  placeId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  distanceLabel(place: PlaceDetails): string {
    return formatDistance(place);
  }

  openingLabel(place: PlaceDetails): string | null {
    return openingStatus(place);
  }

  mediaTone(place: PlaceDetails): string {
    return coverTone(place.nearbyCategory);
  }

  heroPhoto(place: PlaceDetails): PlaceDetails['photos'][number] | undefined {
    return place.photos[0];
  }

  extraPhotos(place: PlaceDetails): PlaceDetails['photos'] {
    return place.photos.slice(1);
  }

  actionClass(action: PlaceExternalAction): string {
    return actionButtonClass(action.kind);
  }

  load(): void {
    const id = this.placeId();
    this.pending.set(true);
    this.loadError.set('');
    this.notFound.set(false);
    this.place.set(null);
    if (!id) {
      this.pending.set(false);
      this.notFound.set(true);
      return;
    }
    this.api.place(id).subscribe({
      next: (body) => {
        this.pending.set(false);
        this.place.set(body);
      },
      error: (err: { status?: number }) => {
        this.pending.set(false);
        this.place.set(null);
        if (err.status === 404) {
          this.notFound.set(true);
          return;
        }
        this.loadError.set('Could not load place details. Try again.');
      },
    });
  }
}
