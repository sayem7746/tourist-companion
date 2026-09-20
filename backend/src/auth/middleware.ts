import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';
import { ACCESS_COOKIE, readCookie, verifyAccessToken } from './tokens.js';
import type { AuthUser } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

function readAccessToken(request: FastifyRequest): string | undefined {
  const bearer = request.headers.authorization;
  const headerToken =
    typeof bearer === 'string' && bearer.startsWith('Bearer ')
      ? bearer.slice('Bearer '.length)
      : undefined;
  const cookieToken = readCookie(request.headers.cookie, ACCESS_COOKIE);
  return headerToken || cookieToken;
}

export function requireAuth(config: AppConfig) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const token = readAccessToken(request);
    if (!token) {
      throw new UnauthorizedError();
    }
    request.user = verifyAccessToken(token, config);
  };
}

/** Attach request.user when a token is present; anonymous is allowed. Invalid tokens still 401. */
export function optionalAuth(config: AppConfig) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const token = readAccessToken(request);
    if (!token) {
      return;
    }
    request.user = verifyAccessToken(token, config);
  };
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
}

function tokensEqual(presented: string, expected: string): boolean {
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function readAdminSecret(request: FastifyRequest): string | undefined {
  const header = headerString(request.headers['x-admin-token']);
  if (header) return header;
  return readAccessToken(request);
}

/** ADMIN_TOKEN via `X-Admin-Token` or Bearer, or a JWT whose payload includes `role: "admin"`. */
export function requireAdmin(config: AppConfig) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const presented = readAdminSecret(request);
    if (presented && tokensEqual(presented, config.ADMIN_TOKEN)) {
      return;
    }

    const access = readAccessToken(request);
    if (access) {
      const user = verifyAccessToken(access, config);
      request.user = user;
      if (user.role === 'admin') {
        return;
      }
      throw new ForbiddenError('Administrator access required');
    }

    throw new UnauthorizedError('Administrator authentication required');
  };
}
