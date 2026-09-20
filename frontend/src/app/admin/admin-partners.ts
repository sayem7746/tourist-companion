import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  PARTNER_CATEGORY_CHIPS,
  PARTNER_CATEGORY_LABELS,
  PartnerAdminService,
  filterListedPartners,
  partnerActionError,
  partnerApprovalBlockers,
  type OpsPartner,
  type PartnerActiveFilter,
  type PartnerCategory,
} from './partner-admin.service';

@Component({
  selector: 'app-admin-partners',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-partners.html',
  styleUrl: './admin-content.css',
})
export class AdminPartners implements OnInit {
  private readonly partners = inject(PartnerAdminService);

  readonly chips = PARTNER_CATEGORY_CHIPS;
  readonly labels = PARTNER_CATEGORY_LABELS;
  readonly items = signal<OpsPartner[]>([]);
  readonly pending = signal(true);
  readonly loadError = signal('');
  readonly actionError = signal('');

  category: PartnerCategory | 'all' = 'all';
  active: PartnerActiveFilter = 'all';
  q = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.actionError.set('');
    this.partners.list(this.category, this.active).subscribe({
      next: ({ partners }) => {
        this.items.set(partners);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load partners.');
      },
    });
  }

  filterCategory(category: PartnerCategory | 'all'): void {
    this.category = category;
    this.load();
  }

  setActive(active: PartnerActiveFilter): void {
    this.active = active;
    this.load();
  }

  visible(): OpsPartner[] {
    return filterListedPartners(this.items(), this.q);
  }

  categoryLabel(partner: OpsPartner): string {
    return this.labels[partner.category];
  }

  statusLabel(partner: OpsPartner): string {
    return partner.isActive ? 'Active' : 'Paused';
  }

  canApprove(partner: OpsPartner): boolean {
    return partnerApprovalBlockers(partner).length === 0;
  }

  approveHint(partner: OpsPartner): string {
    if (partner.isActive) {
      return 'Take this listing off traveler surfaces';
    }
    const blockers = partnerApprovalBlockers(partner);
    return blockers.length
      ? `Cannot approve yet: ${blockers.join('; ')}.`
      : 'Put this listing on traveler surfaces';
  }

  toggleStatus(partner: OpsPartner): void {
    this.actionError.set('');
    if (!partner.isActive && !this.canApprove(partner)) {
      this.actionError.set(
        `Cannot approve ${partner.name}: ${partnerApprovalBlockers(partner).join('; ')}.`,
      );
      return;
    }
    const request = partner.isActive
      ? this.partners.pause(partner.id)
      : this.partners.approve(partner.id);
    const action = partner.isActive ? 'pause' : 'approve';
    request.subscribe({
      next: ({ partner: next }) => {
        this.items.set(this.items().map((row) => (row.id === next.id ? next : row)));
      },
      error: (err: unknown) => {
        this.actionError.set(partnerActionError(err, action));
      },
    });
  }

  remove(partner: OpsPartner): void {
    if (!confirm(`Delete “${partner.name}”? Pause instead if travelers already clicked out.`)) {
      return;
    }
    this.actionError.set('');
    this.partners.delete(partner.id).subscribe({
      next: () => {
        this.items.set(this.items().filter((row) => row.id !== partner.id));
      },
      error: (err: unknown) => {
        this.actionError.set(partnerActionError(err, 'delete'));
      },
    });
  }
}
