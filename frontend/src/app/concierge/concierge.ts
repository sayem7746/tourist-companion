import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ConciergeService,
  DEFAULT_LIVE_CONTEXT,
  DEFAULT_LIVE_CONTEXT_LABEL,
  SOS_COLOR,
  SUGGESTED_CHIPS,
  type ConciergeCategory,
  type ConciergeChatResponse,
  type ConciergeHistoryTurn,
  type ConciergeReply,
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
export class Concierge {
  private readonly api = inject(ConciergeService);

  readonly chips = SUGGESTED_CHIPS;
  readonly liveContextLabel = DEFAULT_LIVE_CONTEXT_LABEL;
  readonly sosColor = SOS_COLOR;

  draft = '';
  conversationId: string | undefined;
  private lastHint: ConciergeCategory | undefined;

  readonly pending = signal(false);
  readonly sendError = signal('');
  readonly sosOpen = signal(false);
  readonly turns = signal<ThreadTurn[]>([]);

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

export function historyFromTurns(turns: ThreadTurn[]): ConciergeHistoryTurn[] {
  const completed = turns.filter((turn) => turn.role === 'user' || turn.role === 'assistant');
  const prior = completed.slice(0, -1);
  return prior.slice(-10).map((turn) => ({ role: turn.role, content: turn.content }));
}
