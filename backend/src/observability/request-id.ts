import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';

export function resolveRequestId(req: IncomingMessage): string {
  const header = req.headers[REQUEST_ID_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().slice(0, 128);
  }
  return randomUUID();
}
