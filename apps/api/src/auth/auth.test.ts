import { describe, expect, it } from "vitest";
import { RateLimit } from "./rateLimit";
import { readCookie } from "./sessions";

describe("readCookie", () => {
  it("finds one cookie among others", () => {
    expect(readCookie("a=1; briefklar_session=abc-_9; b=2", "briefklar_session")).toBe("abc-_9");
    expect(readCookie("briefklar_session_old=x", "briefklar_session")).toBeUndefined();
    expect(readCookie(undefined, "briefklar_session")).toBeUndefined();
  });
});

describe("RateLimit", () => {
  it("blocks after too many events until the window has passed", () => {
    const attempts = new RateLimit(3, 1000);
    for (let i = 0; i < 3; i++) attempts.record("a@example.com", 0);
    expect(attempts.isBlocked("a@example.com", 500)).toBe(true);
    expect(attempts.isBlocked("b@example.com", 500)).toBe(false);
    expect(attempts.isBlocked("a@example.com", 1001)).toBe(false);
  });

  it("forgets the events of a key after a reset", () => {
    const attempts = new RateLimit(2, 1000);
    attempts.record("a@example.com", 0);
    attempts.record("a@example.com", 0);
    attempts.reset("a@example.com");
    expect(attempts.isBlocked("a@example.com", 1)).toBe(false);
  });
});
