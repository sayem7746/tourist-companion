import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import {
  COMMISSION_BASES,
  COMMISSION_BASIS_LABELS,
  CONNECTIVITY_KINDS,
  PARTNER_CATEGORIES,
  PARTNER_CATEGORY_LABELS,
  PartnerAdminService,
  REFERRAL_DISCLOSURE,
  buildPartnerListingDraft,
  defaultCommissionBasis,
  emptyText,
  partnerActionError,
  partnerApprovalBlockers,
  partnerSaveError,
  toTriState,
  type CommissionBasis,
  type ConnectivityKind,
  type OpsPartner,
  type PartnerCategory,
  type PartnerDraft,
  type TriState,
} from './partner-admin.service';

@Component({
  selector: 'app-admin-partner-editor',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-partner-editor.html',
  styleUrl: './admin-content.css',
})
export class AdminPartnerEditor implements OnInit {
  private readonly partners = inject(PartnerAdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly categories = PARTNER_CATEGORIES;
  readonly categoryLabels = PARTNER_CATEGORY_LABELS;
  readonly bases = COMMISSION_BASES;
  readonly basisLabels = COMMISSION_BASIS_LABELS;
  readonly connectivityKinds = CONNECTIVITY_KINDS;
  readonly disclosureDefault = REFERRAL_DISCLOSURE;

  readonly itemId = signal('');
  readonly isActive = signal(false);
  readonly pending = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly actionError = signal('');

  name = '';
  slug = '';
  category: PartnerCategory = 'hotels';
  website = '';
  contactEmail = '';
  summary = '';
  city = '';
  area = '';
  bookingUrl = '';
  reservationUrl = '';
  disclosure = REFERRAL_DISCLOSURE;
  sponsored = false;
  licenseName = '';
  licenseId = '';
  typicalMyr = '';
  languagesText = '';
  hotelClassHint = '';
  vehicleClass = '';
  kul = false;
  klia2 = false;
  meetAndGreet: TriState = '';
  durationHint = '';
  meetingPoint = '';
  connectivityKind: ConnectivityKind | '' = '';
  dataAllowance = '';
  validity = '';
  passportRequired: TriState = '';
  halal: TriState = '';
  deskHours = '';
  commissionRate: number | null = null;
  commissionBasis: CommissionBasis = 'booking';

  isNew(): boolean {
    return !this.itemId();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.itemId.set(id);
    this.pending.set(true);
    this.partners.get(id).subscribe({
      next: ({ partner }) => {
        this.apply(partner);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load this partner.');
      },
    });
  }

  onCategoryChange(category: PartnerCategory): void {
    this.category = category;
    if (this.isNew()) {
      this.commissionBasis = defaultCommissionBasis(category);
    }
  }

  blockers(): string[] {
    return partnerApprovalBlockers(this.draft());
  }

  canApprove(): boolean {
    return !this.isNew() && this.blockers().length === 0 && !this.isActive();
  }

  submit(): void {
    this.saveError.set('');
    this.actionError.set('');
    this.pending.set(true);
    const payload = this.draft();
    const request = this.itemId()
      ? this.partners.update(this.itemId(), payload)
      : this.partners.create(payload);
    request.subscribe({
      next: ({ partner }) => {
        this.pending.set(false);
        this.apply(partner);
        void this.router.navigateByUrl(`/admin/partners/${partner.id}`);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.saveError.set(partnerSaveError(err));
      },
    });
  }

  approve(): void {
    if (!this.canApprove()) {
      this.actionError.set(
        this.blockers().length
          ? `Cannot approve yet: ${this.blockers().join('; ')}.`
          : 'Could not approve this partner.',
      );
      return;
    }
    this.saveError.set('');
    this.actionError.set('');
    this.pending.set(true);
    const id = this.itemId();
    this.partners
      .update(id, this.draft())
      .pipe(switchMap(() => this.partners.approve(id)))
      .subscribe({
        next: ({ partner }) => {
          this.pending.set(false);
          this.apply(partner);
        },
        error: (err: unknown) => {
          this.pending.set(false);
          this.actionError.set(partnerActionError(err, 'approve'));
        },
      });
  }

  pause(): void {
    this.actionError.set('');
    this.pending.set(true);
    this.partners.pause(this.itemId()).subscribe({
      next: ({ partner }) => {
        this.pending.set(false);
        this.apply(partner);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.actionError.set(partnerActionError(err, 'pause'));
      },
    });
  }

  remove(): void {
    if (!confirm(`Delete “${this.name}”? Pause instead if travelers already clicked out.`)) {
      return;
    }
    this.actionError.set('');
    this.pending.set(true);
    this.partners.delete(this.itemId()).subscribe({
      next: () => {
        this.pending.set(false);
        void this.router.navigateByUrl('/admin/partners');
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.actionError.set(partnerActionError(err, 'delete'));
      },
    });
  }

  private apply(partner: OpsPartner): void {
    this.itemId.set(partner.id);
    this.isActive.set(partner.isActive);
    this.name = partner.name;
    this.slug = partner.slug;
    this.category = partner.category;
    this.website = partner.website ?? '';
    this.contactEmail = partner.contactEmail ?? '';
    const listing = partner.listing;
    this.summary = listing?.summary ?? '';
    this.city = listing?.city ?? '';
    this.area = listing?.area ?? '';
    this.bookingUrl = listing?.bookingUrl ?? '';
    this.reservationUrl = listing?.reservationUrl ?? '';
    this.disclosure = listing?.disclosure || REFERRAL_DISCLOSURE;
    this.sponsored = listing?.sponsored ?? false;
    this.licenseName = listing?.licenseName ?? '';
    this.licenseId = listing?.licenseId ?? '';
    this.typicalMyr = listing?.typicalMyr ?? '';
    this.languagesText = (listing?.languages ?? []).join(', ');
    this.hotelClassHint = listing?.hotelClassHint ?? '';
    this.vehicleClass = listing?.vehicleClass ?? '';
    this.kul = listing?.airportCodes?.includes('KUL') ?? false;
    this.klia2 = listing?.airportCodes?.includes('KLIA2') ?? false;
    this.meetAndGreet = toTriState(listing?.meetAndGreet);
    this.durationHint = listing?.durationHint ?? '';
    this.meetingPoint = listing?.meetingPoint ?? '';
    this.connectivityKind = listing?.connectivityKind ?? '';
    this.dataAllowance = listing?.dataAllowance ?? '';
    this.validity = listing?.validity ?? '';
    this.passportRequired = toTriState(listing?.passportRequired);
    this.halal = toTriState(listing?.halal);
    this.deskHours = listing?.deskHours ?? '';
    this.commissionRate = partner.commission?.rate ?? null;
    this.commissionBasis = partner.commission?.basis ?? defaultCommissionBasis(partner.category);
  }

  private draft(): PartnerDraft {
    const payload: PartnerDraft = {
      name: this.name.trim(),
      slug: this.slug.trim() || undefined,
      category: this.category,
      website: emptyText(this.website),
      contactEmail: emptyText(this.contactEmail),
      listing: buildPartnerListingDraft({
        category: this.category,
        summary: this.summary,
        city: this.city,
        area: this.area,
        bookingUrl: this.bookingUrl,
        reservationUrl: this.reservationUrl,
        disclosure: this.disclosure,
        sponsored: this.sponsored,
        licenseName: this.licenseName,
        licenseId: this.licenseId,
        typicalMyr: this.typicalMyr,
        languagesText: this.languagesText,
        hotelClassHint: this.hotelClassHint,
        vehicleClass: this.vehicleClass,
        kul: this.kul,
        klia2: this.klia2,
        meetAndGreet: this.meetAndGreet,
        durationHint: this.durationHint,
        meetingPoint: this.meetingPoint,
        connectivityKind: this.connectivityKind,
        dataAllowance: this.dataAllowance,
        validity: this.validity,
        passportRequired: this.passportRequired,
        halal: this.halal,
        deskHours: this.deskHours,
      }),
    };
    if (this.commissionRate != null && Number.isFinite(Number(this.commissionRate))) {
      payload.commission = {
        rate: Number(this.commissionRate),
        basis: this.commissionBasis,
        currency: 'MYR',
      };
    }
    return payload;
  }
}
