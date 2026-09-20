import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AUDIT_ENTITY_CHIPS,
  AUDIT_ENTITY_LABELS,
  AuditService,
  auditActorLabel,
  formatAuditTime,
  type AuditEntityFilter,
  type AuditEvent,
} from './audit.service';

@Component({
  selector: 'app-admin-audit',
  imports: [RouterLink],
  templateUrl: './admin-audit.html',
  styleUrl: './admin-content.css',
})
export class AdminAudit implements OnInit {
  private readonly audit = inject(AuditService);

  readonly chips = AUDIT_ENTITY_CHIPS;
  readonly labels = AUDIT_ENTITY_LABELS;
  readonly events = signal<AuditEvent[]>([]);
  readonly total = signal(0);
  readonly pending = signal(true);
  readonly loadError = signal('');

  entityType: AuditEntityFilter = 'all';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pending.set(true);
    this.loadError.set('');
    this.audit.list(this.entityType).subscribe({
      next: ({ events, total }) => {
        this.events.set(events);
        this.total.set(total);
        this.pending.set(false);
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load the audit log.');
      },
    });
  }

  filterEntity(entityType: AuditEntityFilter): void {
    this.entityType = entityType;
    this.load();
  }

  actorLabel(event: AuditEvent): string {
    return auditActorLabel(event);
  }

  timeLabel(event: AuditEvent): string {
    return formatAuditTime(event.createdAt);
  }
}
