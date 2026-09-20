import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AppConfig } from '../config.js';
import { UnauthorizedError } from '../errors.js';
import { parseAuthRole, toPublicUser, type AuthUser } from './types.js';

export const ACCESS_COOKIE = 'tc_access';

interface AccessPayload {
  sub: string;
  email: string;
  displayName: string;
  role: AuthUser['role'];
}

export function signAccessToken(
  user: Omit<AuthUser, 'role'> & { role?: AuthUser['role'] },
  config: AppConfig,
): string {
  const payload: AccessPayload = {
    sub: user.id,
    email: user.email,
    displayName: user.displayName,
    role: parseAuthRole(user.role),
  };
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string, config: AppConfig): AuthUser {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as AccessPayload;
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedError('Invalid session');
    }
    return toPublicUser({
      id: payload.sub,
      email: payload.email,
      displayName: payload.displayName ?? '',
      role: payload.role,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired session');
  }
}

export function createResetSecret(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return undefined;
}

export function accessCookie(token: string, config: AppConfig, maxAgeSeconds: number): string {
  const parts = [
    `${ACCESS_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (config.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function clearAccessCookie(config: AppConfig): string {
  return accessCookie('', config, 0);
}
