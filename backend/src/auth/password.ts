import bcrypt from 'bcrypt';

const TEST_ROUNDS = 4;
const DEFAULT_ROUNDS = 10;

export function hashPassword(password: string, nodeEnv: string): Promise<string> {
  const rounds = nodeEnv === 'test' ? TEST_ROUNDS : DEFAULT_ROUNDS;
  return bcrypt.hash(password, rounds);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
