import pg from 'pg';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatLocalIsoDate(value: Date): string {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

/** Calendar DATE values as YYYY-MM-DD (never UTC `toISOString()`, which shifts in UTC+8). */
export function toIsoDate(value: Date | string): string {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return formatLocalIsoDate(parsed);
    return value.slice(0, 10);
  }
  return formatLocalIsoDate(value);
}

export function toIsoDateTime(value: Date | string | null): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return new Date(value).toISOString();
  return value.toISOString();
}

/** node-pg otherwise parses DATE as local midnight, which `toISOString()` then moves back a day east of UTC. */
export function registerPgDateParsers(): void {
  pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);
}
