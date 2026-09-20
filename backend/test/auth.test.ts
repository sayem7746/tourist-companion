import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/auth/password.js';
import { verifyAccessToken } from '../src/auth/tokens.js';
import { parseAuthRole } from '../src/auth/types.js';
import { loadConfig } from '../src/config.js';

const ADMIN_TOKEN = 'test-only-admin-token';
const config = loadConfig({
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3000',
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'test-only-insecure-jwt-secret',
  ADMIN_TOKEN,
});
const app = buildApp(config);

describe('auth endpoints', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs up, reads the current user, and logs out', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'Ada@Example.com',
        password: 'password12',
        displayName: 'Ada',
      },
    });

    expect(signup.statusCode).toBe(201);
    const created = signup.json() as {
      user: { email: string; displayName: string; role: string };
      token: string;
    };
    expect(created.user.email).toBe('ada@example.com');
    expect(created.user.role).toBe('tourist');
    expect(created.token).toBeTruthy();
    expect(verifyAccessToken(created.token, config).role).toBe('tourist');
    const cookie = signup.headers['set-cookie'];
    expect(String(cookie)).toContain('HttpOnly');

    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie: String(cookie) },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ user: { email: 'ada@example.com', role: 'tourist' } });

    const logout = await app.inject({ method: 'POST', url: '/auth/logout' });
    expect(logout.statusCode).toBe(200);
    expect(String(logout.headers['set-cookie'])).toContain('Max-Age=0');
  });

  it('rejects duplicate signup, self-assigned admin role, and invalid login', async () => {
    const payload = {
      email: 'sam@example.com',
      password: 'password12',
      displayName: 'Sam',
    };
    expect((await app.inject({ method: 'POST', url: '/auth/signup', payload })).statusCode).toBe(
      201,
    );

    const duplicate = await app.inject({ method: 'POST', url: '/auth/signup', payload });
    expect(duplicate.statusCode).toBe(409);

    const withRole = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { ...payload, email: 'sam-admin@example.com', role: 'admin' },
    });
    expect(withRole.statusCode).toBe(400);

    const badLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'sam@example.com', password: 'wrong-pass' },
    });
    expect(badLogin.statusCode).toBe(401);

    const goodLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'sam@example.com', password: 'password12' },
    });
    expect(goodLogin.statusCode).toBe(200);
    expect(goodLogin.json()).toMatchObject({ user: { email: 'sam@example.com', role: 'tourist' } });
  });

  it('protects /auth/me without a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(response.statusCode).toBe(401);
  });

  it('resets a password and allows login with the new one', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'reset@example.com',
        password: 'old-password',
        displayName: 'Reset',
      },
    });

    const forgot = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'reset@example.com' },
    });
    expect(forgot.statusCode).toBe(200);
    const { resetToken } = forgot.json() as { resetToken: string };
    expect(resetToken).toBeTruthy();

    const reset = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: resetToken, password: 'new-password' },
    });
    expect(reset.statusCode).toBe(200);

    const oldLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'reset@example.com', password: 'old-password' },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'reset@example.com', password: 'new-password' },
    });
    expect(newLogin.statusCode).toBe(200);

    const bearerMe = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${(newLogin.json() as { token: string }).token}` },
    });
    expect(bearerMe.statusCode).toBe(200);
    expect(bearerMe.json()).toMatchObject({ user: { role: 'tourist' } });
  });

  it('treats unknown roles as tourist', () => {
    expect(parseAuthRole('admin')).toBe('admin');
    expect(parseAuthRole('tourist')).toBe('tourist');
    expect(parseAuthRole('superuser')).toBe('tourist');
    expect(parseAuthRole(undefined)).toBe('tourist');
  });

  it('rejects tourist credentials and tourist JWTs on admin routes', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'tourist-ops@example.com',
        password: 'password12',
        displayName: 'Tourist',
      },
    });
    expect(signup.statusCode).toBe(201);
    const { token } = signup.json() as { token: string };

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/admin/login',
      payload: { email: 'tourist-ops@example.com', password: 'password12' },
    });
    expect(adminLogin.statusCode).toBe(403);
    expect(String(adminLogin.headers['set-cookie'] ?? '')).not.toContain('tc_access=');

    const partners = await app.inject({
      method: 'GET',
      url: '/admin/partners',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(partners.statusCode).toBe(403);
  });

  it('issues an admin JWT from /auth/admin/login and still accepts ADMIN_TOKEN', async () => {
    const store = app.getAuthStore();
    expect(store).toBeDefined();
    const passwordHash = await hashPassword('password12', 'test');
    await store!.createUser({
      email: 'ops@example.com',
      displayName: 'Ops',
      passwordHash,
      role: 'admin',
    });

    const touristLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ops@example.com', password: 'password12' },
    });
    expect(touristLogin.statusCode).toBe(200);
    expect(touristLogin.json()).toMatchObject({ user: { role: 'admin' } });

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/admin/login',
      payload: { email: 'ops@example.com', password: 'password12' },
    });
    expect(adminLogin.statusCode).toBe(200);
    const body = adminLogin.json() as { token: string; user: { role: string; email: string } };
    expect(body.user).toMatchObject({ email: 'ops@example.com', role: 'admin' });
    expect(verifyAccessToken(body.token, config).role).toBe('admin');

    const viaJwt = await app.inject({
      method: 'GET',
      url: '/admin/partners',
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(viaJwt.statusCode).toBe(200);

    const viaHeader = await app.inject({
      method: 'GET',
      url: '/admin/partners',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    });
    expect(viaHeader.statusCode).toBe(200);

    const viaBearerToken = await app.inject({
      method: 'GET',
      url: '/admin/partners',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(viaBearerToken.statusCode).toBe(200);
  });

  it('rejects invalid admin login credentials', async () => {
    const missing = await app.inject({
      method: 'POST',
      url: '/auth/admin/login',
      payload: { email: 'nobody@example.com', password: 'password12' },
    });
    expect(missing.statusCode).toBe(401);
  });

  it('does not leak reset tokens for unknown emails', async () => {
    const forgot = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'nobody@example.com' },
    });
    expect(forgot.statusCode).toBe(200);
    const body = forgot.json() as { ok: true; resetToken?: string };
    expect(body.ok).toBe(true);
    expect(body.resetToken).toBeUndefined();
  });

  it('rejects short passwords and invalid reset tokens', async () => {
    const short = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'short-pass@example.com', password: 'short', displayName: 'Short' },
    });
    expect(short.statusCode).toBe(400);

    const reset = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'this-token-is-long-enough-but-unknown', password: 'new-password' },
    });
    expect(reset.statusCode).toBe(400);
  });

  it('invalidates unused reset tokens after a successful reset', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'multi-reset@example.com',
        password: 'old-password',
        displayName: 'Multi',
      },
    });

    const first = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'multi-reset@example.com' },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'multi-reset@example.com' },
    });
    const firstToken = (first.json() as { resetToken: string }).resetToken;
    const secondToken = (second.json() as { resetToken: string }).resetToken;
    expect(firstToken).not.toBe(secondToken);

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/reset-password',
          payload: { token: secondToken, password: 'new-password' },
        })
      ).statusCode,
    ).toBe(200);

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/reset-password',
          payload: { token: firstToken, password: 'other-password' },
        })
      ).statusCode,
    ).toBe(400);
  });

  it('rejects unsigned JWT payloads', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: '00000000-0000-0000-0000-000000000001',
        email: 'forged@example.com',
        displayName: 'Forged',
        role: 'admin',
      }),
    ).toString('base64url');
    expect(() => verifyAccessToken(`${header}.${payload}.`, config)).toThrow(/Invalid/);
  });
});

describe('auth rate limits', () => {
  const limitedApp = buildApp(
    loadConfig({
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: '3000',
      LOG_LEVEL: 'silent',
      JWT_SECRET: 'test-only-insecure-jwt-secret',
      ADMIN_TOKEN,
      AUTH_RATE_LIMIT_MAX: '1',
      AUTH_RATE_LIMIT_WINDOW_MS: '60000',
    }),
  );

  beforeAll(async () => {
    await limitedApp.ready();
  });

  afterAll(async () => {
    await limitedApp.close();
  });

  it('returns 429 after the authentication budget is spent', async () => {
    const first = await limitedApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'rate-limit@example.com', password: 'password12' },
    });
    expect(first.statusCode).toBe(401);

    const second = await limitedApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'rate-limit@example.com', password: 'password12' },
    });
    expect(second.statusCode).toBe(429);
    expect(second.headers['retry-after']).toBeTruthy();
    expect((second.json() as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
  });
});
