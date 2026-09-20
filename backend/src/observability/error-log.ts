import type { AppConfig } from '../config.js';

export type SerializedError = {
  type?: string;
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
};

export function serializeErrorForLog(error: unknown, config: AppConfig): SerializedError {
  const err = error as { name?: string; message?: string; code?: string; statusCode?: number; stack?: string };
  const payload: SerializedError = {
    type: typeof err?.name === 'string' ? err.name : undefined,
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  };
  if (typeof err?.code === 'string') {
    payload.code = err.code;
  }
  if (typeof err?.statusCode === 'number') {
    payload.statusCode = err.statusCode;
  }
  if (config.NODE_ENV !== 'production' && typeof err?.stack === 'string') {
    payload.stack = err.stack;
  }
  return payload;
}
