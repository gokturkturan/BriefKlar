/**
 * Slows down password guessing: after MAX_FAILURES failed sign-ins for one e-mail address,
 * further attempts are refused until the window has passed. Kept in memory, which is enough for
 * the single API process; a restart clears it.
 */
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

export class LoginAttempts {
  private failures = new Map<string, { count: number; since: number }>();

  constructor(
    private readonly maxFailures = MAX_FAILURES,
    private readonly windowMs = WINDOW_MS,
  ) {}

  isBlocked(key: string, now = Date.now()): boolean {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (now - entry.since > this.windowMs) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= this.maxFailures;
  }

  recordFailure(key: string, now = Date.now()): void {
    const entry = this.failures.get(key);
    if (!entry || now - entry.since > this.windowMs) this.failures.set(key, { count: 1, since: now });
    else entry.count += 1;
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}

export const loginAttempts = new LoginAttempts();
