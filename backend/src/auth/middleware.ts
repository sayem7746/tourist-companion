import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.js';
import { UnauthorizedError } from '../errors.js';
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
