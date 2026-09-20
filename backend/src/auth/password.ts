import bcrypt from 'bcrypt';

const TEST_ROUNDS = 4;
const DEFAULT_ROUNDS = 10;

/** Precomputed bcrypt hashes of a non-user password so missing accounts still pay compare cost. */
const DUMMY_HASH_BY_ROUNDS: Record<number, string> = {
  4: '$2b$04$xTe1DQUMYAdH1d3sHSIUIuqXPNqtzmKq80WWwJIA1o95XF3INL8tu',
  10: '$2b$10$x2itidjTQOZSwxjxYThgmeGqTJ7wSRGVJRnFOHYDhnIZcRqC7niVG',
};

export function hashPassword(password: string, nodeEnv: string): Promise<string> {
  const rounds = nodeEnv === 'test' ? TEST_ROUNDS : DEFAULT_ROUNDS;
  return bcrypt.hash(password, rounds);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function verifyPasswordAgainstRecord(
  password: string,
  passwordHash: string | null | undefined,
  nodeEnv: string,
): Promise<boolean> {
  const rounds = nodeEnv === 'test' ? TEST_ROUNDS : DEFAULT_ROUNDS;
  const dummyHash = DUMMY_HASH_BY_ROUNDS[rounds] ?? DUMMY_HASH_BY_ROUNDS[DEFAULT_ROUNDS]!;
  if (!passwordHash) {
    await verifyPassword(password, dummyHash);
    return false;
  }
  return verifyPassword(password, passwordHash);
}
