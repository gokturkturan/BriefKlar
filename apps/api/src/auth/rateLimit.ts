/**
 * Counts events per key (an e-mail address, an IP address) in a time window and says when there
 * were too many. Kept in memory, which is enough for the single API process; a restart clears it.
 */
export class RateLimit {
  private events = new Map<string, { count: number; since: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  isBlocked(key: string, now = Date.now()): boolean {
    const entry = this.events.get(key);
    if (!entry) return false;
    if (now - entry.since > this.windowMs) {
      this.events.delete(key);
      return false;
    }
    return entry.count >= this.max;
  }

  record(key: string, now = Date.now()): void {
    const entry = this.events.get(key);
    if (!entry || now - entry.since > this.windowMs) this.events.set(key, { count: 1, since: now });
    else entry.count += 1;
  }

  reset(key: string): void {
    this.events.delete(key);
  }
}

const MINUTE = 60 * 1000;

/** Failed sign-ins per e-mail address: slows down password guessing */
export const failedLogins = new RateLimit(10, 15 * MINUTE);

/** New guest sessions per IP address: keeps a script from creating guests (and AI costs) in bulk */
export const guestStarts = new RateLimit(10, 60 * MINUTE);
