import type pg from 'pg';
import { ConflictError } from '../errors.js';
import type { AuthStore, AuthUser, UserRecord } from './types.js';

export function createPgAuthStore(pool: pg.Pool): AuthStore {
  return {
    async createUser(input) {
      try {
        const result = await pool.query<AuthUser>(
          `INSERT INTO users (email, display_name, password_hash)
           VALUES ($1, $2, $3)
           RETURNING id, email, display_name AS "displayName"`,
          [input.email, input.displayName, input.passwordHash],
        );
        return result.rows[0];
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError('An account with this email already exists');
        }
        throw error;
      }
    },
    async findByEmail(email) {
      const result = await pool.query<UserRecord>(
        `SELECT id, email, display_name AS "displayName", password_hash AS "passwordHash"
         FROM users WHERE email = $1`,
        [email],
      );
      return result.rows[0];
    },
    async findById(id) {
      const result = await pool.query<UserRecord>(
        `SELECT id, email, display_name AS "displayName", password_hash AS "passwordHash"
         FROM users WHERE id = $1`,
        [id],
      );
      return result.rows[0];
    },
    async updatePasswordHash(userId, passwordHash) {
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        passwordHash,
        userId,
      ]);
    },
    async createResetToken(input) {
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [input.userId, input.tokenHash, input.expiresAt],
      );
    },
    async findResetToken(tokenHash) {
      const result = await pool.query<{
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        usedAt: Date | null;
      }>(
        `SELECT user_id AS "userId", token_hash AS "tokenHash",
                expires_at AS "expiresAt", used_at AS "usedAt"
         FROM password_reset_tokens WHERE token_hash = $1`,
        [tokenHash],
      );
      return result.rows[0];
    },
    async markResetTokenUsed(tokenHash) {
      await pool.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1',
        [tokenHash],
      );
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}
