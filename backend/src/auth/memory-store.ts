import { randomUUID } from 'node:crypto';
import { ConflictError } from '../errors.js';
import type { AuthStore, AuthUser, ResetTokenRecord, UserRecord } from './types.js';

export function createMemoryAuthStore(): AuthStore {
  const usersById = new Map<string, UserRecord>();
  const usersByEmail = new Map<string, UserRecord>();
  const resetTokens = new Map<string, ResetTokenRecord>();

  return {
    async createUser(input) {
      if (usersByEmail.has(input.email)) {
        throw new ConflictError('An account with this email already exists');
      }
      const user: UserRecord = {
        id: randomUUID(),
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
      };
      usersById.set(user.id, user);
      usersByEmail.set(user.email, user);
      return toPublic(user);
    },
    async findByEmail(email) {
      return usersByEmail.get(email);
    },
    async findById(id) {
      return usersById.get(id);
    },
    async updatePasswordHash(userId, passwordHash) {
      const user = usersById.get(userId);
      if (!user) return;
      const updated = { ...user, passwordHash };
      usersById.set(userId, updated);
      usersByEmail.set(updated.email, updated);
    },
    async createResetToken(input) {
      resetTokens.set(input.tokenHash, {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        usedAt: null,
      });
    },
    async findResetToken(tokenHash) {
      return resetTokens.get(tokenHash);
    },
    async markResetTokenUsed(tokenHash) {
      const existing = resetTokens.get(tokenHash);
      if (!existing) return;
      resetTokens.set(tokenHash, { ...existing, usedAt: new Date() });
    },
  };
}

function toPublic(user: UserRecord): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
}
