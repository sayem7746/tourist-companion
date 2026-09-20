export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
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

export interface AuthStore {
  createUser(input: {
    email: string;
    displayName: string;
    passwordHash: string;
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
