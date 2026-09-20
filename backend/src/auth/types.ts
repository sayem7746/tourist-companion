export type AuthRole = 'tourist' | 'admin';

export function parseAuthRole(value: unknown): AuthRole {
  return value === 'admin' ? 'admin' : 'tourist';
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: AuthRole;
}

export interface UserRecord extends AuthUser {
  passwordHash: string | null;
}

export interface ResetTokenRecord {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export function toPublicUser(user: {
  id: string;
  email: string;
  displayName: string;
  role?: unknown;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: parseAuthRole(user.role),
  };
}

export interface AuthStore {
  createUser(input: {
    email: string;
    displayName: string;
    passwordHash: string;
    role?: AuthRole;
  }): Promise<AuthUser>;
  findByEmail(email: string): Promise<UserRecord | undefined>;
  findById(id: string): Promise<UserRecord | undefined>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  createResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findResetToken(tokenHash: string): Promise<ResetTokenRecord | undefined>;
  markResetTokenUsed(tokenHash: string): Promise<void>;
}

declare module 'fastify' {
  interface FastifyInstance {
    getAuthStore: () => AuthStore | undefined;
  }
}
