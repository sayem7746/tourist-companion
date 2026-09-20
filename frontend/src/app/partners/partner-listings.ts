import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import {
  PartnerService,
  filterPublicPartners,
  openOutbound,
  partnerCategoryLabel,
  partnerCtaLabel,
  partnerDisclosure,
  partnerLocation,
  partnerOutboundUrl,
  SPONSORED_BADGE_COLOR,
  SPONSORED_BADGE_LABEL,
  SPONSORED_BADGE_TINT,
  type ArrivalAirportCode,
  type PartnerCategory,
  type ReferralChannel,
  type TouristProvider,
} from './partner.service';

@Component({
  selector: 'app-partner-listings',
  templateUrl: './partner-listings.html',
  styleUrl: './partner-listings.css',
})
export class PartnerListings implements OnInit, OnChanges {
  private readonly api = inject(PartnerService);

  @Input() heading = 'Partner services';
  @Input() channel: ReferralChannel = 'explore';
  @Input() categories: PartnerCategory[] | null = null;
  @Input() airport: ArrivalAirportCode | null = null;
  @Input() city: string | null = null;
  @Input() tripId: string | null = null;
  @Input() placeId: string | null = null;
  @Input() itineraryItemId: string | null = null;
  @Input() partnerIds: string[] | null = null;
  @Input() compact = false;
  @Input() limit = 0;

  readonly sponsoredLabel = SPONSORED_BADGE_LABEL;
  readonly sponsoredColor = SPONSORED_BADGE_COLOR;
  readonly sponsoredTint = SPONSORED_BADGE_TINT;

  readonly pending = signal(false);
  readonly loadError = signal('');
  readonly openingId = signal<string | null>(null);
  readonly catalog = signal<TouristProvider[]>([]);
  readonly partners = signal<TouristProvider[]>([]);

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories'] || changes['airport'] || changes['city'] || changes['partnerIds'] || changes['limit']) {
      this.applyFilter();
    }
  }

  categoryLabel(category: PartnerCategory): string {
    return partnerCategoryLabel(category);
  }

  ctaLabel(partner: TouristProvider): string {
    return partnerCtaLabel(partner.category);
  }

  disclosure(partner: TouristProvider): string {
    return partnerDisclosure(partner);
  }

  location(partner: TouristProvider): string {
    return partnerLocation(partner);
  }

  outbound(partner: TouristProvider): string | null {
    return partnerOutboundUrl(partner);
  }

  facts(partner: TouristProvider): string[] {
    const listing = partner.listing;
    if (!listing) {
      return [];
    }
    const lines: string[] = [];
    if (listing.typicalMyr) {
      lines.push(listing.typicalMyr);
    }
    if (listing.hotelClassHint) {
      lines.push(listing.hotelClassHint);
    }
    if (listing.vehicleClass) {
      lines.push(listing.vehicleClass);
    }
    if (listing.meetAndGreet) {
      lines.push('Meet and greet');
    }
    if (listing.durationHint) {
      lines.push(listing.durationHint);
    }
    if (listing.meetingPoint) {
      lines.push(listing.meetingPoint);
    }
    if (listing.connectivityKind === 'esim') {
      lines.push('eSIM');
    } else if (listing.connectivityKind === 'prepaid_sim') {
      lines.push('Prepaid SIM');
    }
    if (listing.dataAllowance) {
      lines.push(listing.dataAllowance);
    }
    if (listing.validity) {
      lines.push(listing.validity);
    }
    if (listing.passportRequired) {
      lines.push('Passport required');
    }
    if (listing.halal) {
      lines.push('Halal');
    }
    if (listing.deskHours) {
      lines.push(listing.deskHours);
    }
    if (listing.licenseName) {
      lines.push(listing.licenseName);
    }
    return lines.slice(0, 4);
  }

  load(refresh = false): void {
    if (this.categories && this.categories.length === 0 && !this.partnerIds?.length) {
      this.catalog.set([]);
      this.partners.set([]);
      this.pending.set(false);
      this.loadError.set('');
      return;
    }
    this.pending.set(true);
    this.loadError.set('');
    const request = refresh ? this.api.refresh() : this.api.list();
    request.subscribe({
      next: (partners) => {
        this.catalog.set(partners);
        this.applyFilter();
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.catalog.set([]);
        this.partners.set([]);
        this.loadError.set('Could not load partner services. Try again.');
      },
    });
  }

  open(partner: TouristProvider): void {
    const fallback = partnerOutboundUrl(partner);
    if (!fallback || this.openingId() === partner.id) {
      return;
    }
    this.openingId.set(partner.id);
    this.api
      .trackClick({
        providerId: partner.id,
        channel: this.channel,
        tripId: this.tripId,
        placeId: this.placeId,
        itineraryItemId: this.itineraryItemId,
        clickKey: `${this.channel}:${partner.id}:${this.placeId || this.itineraryItemId || this.tripId || 'anon'}`,
      })
      .subscribe({
        next: (result) => {
          this.openingId.set(null);
          openOutbound(result.outboundUrl || fallback);
        },
        error: () => {
          this.openingId.set(null);
          openOutbound(fallback);
        },
      });
  }

  private applyFilter(): void {
    this.partners.set(
      filterPublicPartners(this.catalog(), {
        categories: this.categories,
        airport: this.airport,
        city: this.city,
        partnerIds: this.partnerIds,
        limit: this.limit || undefined,
      }),
    );
  }
}
