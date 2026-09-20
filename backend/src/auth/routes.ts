import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import {
  ForbiddenError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from '../errors.js';
import { validateRequest } from '../validate.js';
import { requireAuth } from './middleware.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  accessCookie,
  clearAccessCookie,
  createResetSecret,
  hashToken,
  signAccessToken,
} from './tokens.js';
import { toPublicUser, type AuthStore, type AuthUser } from './types.js';

const credentialsSchema = z
  .object({
    email: z.string().email().transform((value) => value.trim().toLowerCase()),
    password: z.string().min(8).max(128),
  })
  .strict();

const signupSchema = credentialsSchema
  .extend({
    displayName: z.string().trim().min(1).max(80),
  })
  .strict();

const forgotSchema = z
  .object({
    email: z.string().email().transform((value) => value.trim().toLowerCase()),
  })
  .strict();

const resetSchema = z
  .object({
    token: z.string().min(16),
    password: z.string().min(8).max(128),
  })
  .strict();

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export async function registerAuthRoutes(
  app: FastifyInstance,
  config: AppConfig,
  resolveStore: () => AuthStore | undefined,
): Promise<void> {
  const getStore = (): AuthStore => {
    const store = resolveStore();
    if (!store) {
      throw new ServiceUnavailableError('Authentication store is not configured');
    }
    return store;
  };

  const setSession = (reply: { header: (k: string, v: string) => unknown }, user: AuthUser) => {
    const sessionUser = toPublicUser(user);
    const token = signAccessToken(sessionUser, config);
    reply.header('Set-Cookie', accessCookie(token, config, COOKIE_MAX_AGE));
    return { user: sessionUser, token };
  };

  app.post('/auth/signup', async (request, reply) => {
    const { body } = validateRequest(request, { body: signupSchema });
    const passwordHash = await hashPassword(body.password, config.NODE_ENV);
    const user = await getStore().createUser({
      email: body.email,
      displayName: body.displayName,
      passwordHash,
    });
    const session = setSession(reply, user);
    return reply.status(201).send(session);
  });

  const loginHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
    requireAdminRole: boolean,
  ) => {
    const { body } = validateRequest(request, { body: credentialsSchema });
    const record = await getStore().findByEmail(body.email);
    if (!record?.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const matches = await verifyPassword(body.password, record.passwordHash);
    if (!matches) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const user = toPublicUser(record);
    if (requireAdminRole && user.role !== 'admin') {
      throw new ForbiddenError('Administrator access required');
    }
    return setSession(reply, user);
  };

  app.post('/auth/login', async (request, reply) => loginHandler(request, reply, false));

  app.post('/auth/admin/login', async (request, reply) => loginHandler(request, reply, true));

  app.post('/auth/logout', async (_request, reply) => {
    reply.header('Set-Cookie', clearAccessCookie(config));
    return { ok: true };
  });

  app.post('/auth/forgot-password', async (request) => {
    const { body } = validateRequest(request, { body: forgotSchema });
    const record = await getStore().findByEmail(body.email);
    const payload: { ok: true; resetToken?: string } = { ok: true };
    if (record) {
      const secret = createResetSecret();
      await getStore().createResetToken({
        userId: record.id,
        tokenHash: secret.tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      if (config.NODE_ENV !== 'production') {
        payload.resetToken = secret.token;
      }
    }
    return payload;
  });

  app.post('/auth/reset-password', async (request) => {
    const { body } = validateRequest(request, { body: resetSchema });
    const tokenHash = hashToken(body.token);
    const reset = await getStore().findResetToken(tokenHash);
    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
      throw new ValidationError('Invalid or expired reset token');
    }
    const passwordHash = await hashPassword(body.password, config.NODE_ENV);
    await getStore().updatePasswordHash(reset.userId, passwordHash);
    await getStore().markResetTokenUsed(tokenHash);
    return { ok: true };
  });

  app.get('/auth/me', { preHandler: requireAuth(config) }, async (request) => {
    return { user: request.user };
  });
}
