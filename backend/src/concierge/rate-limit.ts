export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  take(key: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
    const now = this.now();
    const windowStart = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((stamp) => stamp > windowStart);
    if (recent.length >= this.max) {
      const oldest = recent[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      this.hits.set(key, recent);
      return { ok: false, retryAfterSeconds };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return { ok: true };
  }
}
