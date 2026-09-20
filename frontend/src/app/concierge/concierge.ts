import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import {
  ConciergeService,
  DEFAULT_LIVE_CONTEXT,
  DEFAULT_LIVE_CONTEXT_LABEL,
  SOS_COLOR,
  SOS_NUMBERS,
  SUGGESTED_CHIPS,
  type ConciergeCategory,
  type ConciergeChatResponse,
  type ConciergeHistoryResponse,
  type ConciergeHistoryTurn,
  type ConciergeReply,
  type ConciergeRetention,
} from './concierge.service';

export interface ThreadTurn {
  role: 'user' | 'assistant';
  content: string;
  time?: string;
  reply?: ConciergeReply;
}

@Component({
  selector: 'app-concierge',
  imports: [FormsModule, RouterLink],
  templateUrl: './concierge.html',
  styleUrl: './concierge.css',
})
export class Concierge implements OnInit {
  private readonly api = inject(ConciergeService);
  private readonly auth = inject(AuthService);

  readonly chips = SUGGESTED_CHIPS;
  readonly liveContextLabel = DEFAULT_LIVE_CONTEXT_LABEL;
  readonly sosColor = SOS_COLOR;
  readonly sosNumbers = SOS_NUMBERS;

  draft = '';
  conversationId: string | undefined;
  tripId: string | undefined;
  private lastHint: ConciergeCategory | undefined;

  readonly pending = signal(false);
  readonly sendError = signal('');
  readonly sosOpen = signal(false);
  readonly turns = signal<ThreadTurn[]>([]);
  readonly signedIn = signal(false);
  readonly retentionNote = signal('');
  readonly historyError = signal('');
  readonly clearing = signal(false);

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: () => {
        this.signedIn.set(true);
        this.api.history().subscribe({
          next: (body) => this.applyHistory(body),
          error: () => this.historyError.set('Could not load saved chat.'),
        });
      },
      error: () => this.signedIn.set(false),
    });
  }

  submitDraft(): void {
    this.send(this.draft);
  }

  sendChip(label: string, categoryHint: ConciergeCategory): void {
    this.send(label, categoryHint);
  }

  sendFollowUp(label: string): void {
    if (label.toLowerCase().includes('sos')) {
      this.openSos();
      return;
    }
    this.send(label);
  }

  retry(): void {
    const lastUser = [...this.turns()].reverse().find((turn) => turn.role === 'user');
    if (lastUser) {
      this.post(lastUser.content, this.lastHint);
    }
  }

  openSos(): void {
    this.sosOpen.set(true);
  }

  closeSos(): void {
    this.sosOpen.set(false);
  }

  clearHistory(): void {
    if (!this.signedIn() || this.clearing()) {
      return;
    }
    this.clearing.set(true);
    this.historyError.set('');
    this.api.deleteHistory(this.tripId).subscribe({
      next: () => {
        this.clearing.set(false);
        this.turns.set([]);
        this.conversationId = undefined;
      },
      error: () => {
        this.clearing.set(false);
        this.historyError.set('Could not delete saved chat. Try again.');
      },
    });
  }

  private applyHistory(body: ConciergeHistoryResponse): void {
    this.tripId = body.tripId ?? undefined;
    this.conversationId = body.conversationId ?? undefined;
    this.retentionNote.set(formatRetentionNote(body.retention, Boolean(body.tripId)));
    this.turns.set(
      body.messages.map((message) => ({
        role: message.role,
        content: message.content,
        time: formatClock(new Date(message.createdAt)),
      })),
    );
  }

  private send(raw: string, categoryHint?: ConciergeCategory): void {
    const message = raw.trim();
    if (!message || this.pending()) {
      return;
    }
    this.draft = '';
    this.lastHint = categoryHint;
    this.turns.update((list) => [
      ...list,
      { role: 'user', content: message, time: formatClock() },
    ]);
    this.post(message, categoryHint);
  }

  private post(message: string, categoryHint?: ConciergeCategory): void {
    this.pending.set(true);
    this.sendError.set('');
    const history = historyFromTurns(this.turns());
    this.api
      .chat({
        message,
        conversationId: this.conversationId,
        tripId: this.tripId,
        history,
        context: DEFAULT_LIVE_CONTEXT,
        categoryHint,
      })
      .subscribe({
        next: (body) => this.onReply(body),
        error: () => {
          this.pending.set(false);
          this.sendError.set('Could not reach the concierge. Try again.');
        },
      });
  }

  private onReply(body: ConciergeChatResponse): void {
    this.conversationId = body.conversationId;
    if (body.tripId) {
      this.tripId = body.tripId;
    }
    this.pending.set(false);
    this.turns.update((list) => [
      ...list,
      { role: 'assistant', content: body.reply.text, reply: body.reply },
    ]);
    if (body.reply.sos) {
      this.sosOpen.set(true);
    }
  }
}

export function formatClock(now = new Date()): string {
  return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatRetentionNote(retention: ConciergeRetention, hasTrip: boolean): string {
  if (!hasTrip) {
    return 'Save a trip to keep the last messages of this chat on the server.';
  }
  const days = Math.max(1, Math.round(retention.ttlMs / 86_400_000));
  return `We keep the last ${retention.maxMessages} messages for this trip for ${days} day${days === 1 ? '' : 's'}. Emergency chats are not stored. You can delete them anytime.`;
}

export function historyFromTurns(turns: ThreadTurn[]): ConciergeHistoryTurn[] {
  const completed = turns.filter((turn) => turn.role === 'user' || turn.role === 'assistant');
  const prior = completed.slice(0, -1);
  return prior.slice(-10).map((turn) => ({ role: turn.role, content: turn.content }));
}
