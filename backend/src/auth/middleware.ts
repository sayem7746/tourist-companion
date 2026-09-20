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

export function requireAuth(config: AppConfig) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const bearer = request.headers.authorization;
    const headerToken =
      typeof bearer === 'string' && bearer.startsWith('Bearer ')
        ? bearer.slice('Bearer '.length)
        : undefined;
    const cookieToken = readCookie(request.headers.cookie, ACCESS_COOKIE);
    const token = headerToken || cookieToken;
    if (!token) {
      throw new UnauthorizedError();
    }
    request.user = verifyAccessToken(token, config);
  };
}
