import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const app = buildApp(
  loadConfig({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3000',
    LOG_LEVEL: 'silent',
    JWT_SECRET: 'test-only-insecure-jwt-secret',
  }),
);

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
      user: { email: string; displayName: string };
      token: string;
    };
    expect(created.user.email).toBe('ada@example.com');
    expect(created.token).toBeTruthy();
    const cookie = signup.headers['set-cookie'];
    expect(String(cookie)).toContain('HttpOnly');

    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie: String(cookie) },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ user: { email: 'ada@example.com' } });

    const logout = await app.inject({ method: 'POST', url: '/auth/logout' });
    expect(logout.statusCode).toBe(200);
    expect(String(logout.headers['set-cookie'])).toContain('Max-Age=0');
  });

  it('rejects duplicate signup and invalid login', async () => {
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
  });
});
