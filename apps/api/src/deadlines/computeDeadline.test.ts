import { describe, expect, it } from "vitest";
import { computeRelativeDeadline, type DeadlineInput } from "./computeDeadline";

function due(input: DeadlineInput) {
  const result = computeRelativeDeadline(input);
  if (!result.ok) throw new Error(`Expected a due date, got: ${result.reason}`);
  return result;
}

const MONTH_AFTER_NOTICE = "innerhalb eines Monats nach Bekanntgabe";

describe("computeRelativeDeadline", () => {
  describe("letters from authorities (delivery rule)", () => {
    it("counts one month from the 4th day after the letter date", () => {
      // Thu 12 Nov 2026 -> delivered Mon 16 Nov -> Wed 16 Dec
      const result = due({ rawText: MONTH_AFTER_NOTICE, letterDate: "2026-11-12", senderType: "JOBCENTER" });
      expect(result.dueDate).toBe("2026-12-16");
      expect(result.isEstimate).toBe(true);
      expect(result.explanation[0]).toContain("4th day");
    });

    it("moves the delivery day off a weekend before counting", () => {
      // Tue 3 Mar 2026 + 4 = Sat 7 Mar -> Mon 9 Mar -> Thu 9 Apr
      const result = due({ rawText: MONTH_AFTER_NOTICE, letterDate: "2026-03-03", senderType: "FINANZAMT" });
      expect(result.dueDate).toBe("2026-04-09");
      expect(result.explanation.join(" ")).toContain("is a Saturday, so the delivery date moves");
    });

    it("uses the 3-day rule for letters dated before 2025", () => {
      // Fri 20 Dec 2024 + 3 = Mon 23 Dec -> Thu 23 Jan 2025
      const result = due({ rawText: MONTH_AFTER_NOTICE, letterDate: "2024-12-20", senderType: "FINANZAMT" });
      expect(result.dueDate).toBe("2025-01-23");
      expect(result.explanation[0]).toContain("3rd day");
    });

    it("counts weeks to the same weekday", () => {
      // Thu 12 Nov 2026 -> delivered Mon 16 Nov -> Mon 30 Nov
      const result = due({
        rawText: "binnen zwei Wochen nach Zugang",
        letterDate: "2026-11-12",
        senderType: "AUSLAENDERBEHOERDE",
      });
      expect(result.dueDate).toBe("2026-11-30");
    });

    it("ends on the last day of a shorter month", () => {
      // Fri 27 Mar 2026 -> delivered Tue 31 Mar -> 30 Apr (April has no 31st)
      const result = due({ rawText: MONTH_AFTER_NOTICE, letterDate: "2026-03-27", senderType: "KRANKENKASSE" });
      expect(result.dueDate).toBe("2026-04-30");
    });

    it("counts years", () => {
      // Thu 25 Feb 2027 -> delivered Mon 1 Mar 2027 -> Wed 1 Mar 2028
      const result = due({
        rawText: "binnen eines Jahres nach Bekanntgabe",
        letterDate: "2027-02-25",
        senderType: "FAMILIENKASSE",
      });
      expect(result.dueDate).toBe("2028-03-01");
    });
  });

  describe("end on a weekend or holiday (§ 193 BGB)", () => {
    it("moves a deadline ending on a Sunday to Monday", () => {
      // Mon 8 Jun 2026 -> delivered Fri 12 Jun -> Sun 12 Jul -> Mon 13 Jul
      const result = due({ rawText: MONTH_AFTER_NOTICE, letterDate: "2026-06-08", senderType: "FINANZAMT" });
      expect(result.dueDate).toBe("2026-07-13");
      expect(result.explanation.at(-1)).toContain("is a Sunday, so the deadline moves");
    });

    it("skips Christmas and the weekend after it", () => {
      // Sat 21 Nov 2026 -> delivered Wed 25 Nov -> Fri 25 Dec -> Mon 28 Dec
      const result = due({ rawText: MONTH_AFTER_NOTICE, letterDate: "2026-11-21", senderType: "FINANZAMT" });
      expect(result.dueDate).toBe("2026-12-28");
      expect(result.explanation.join(" ")).toContain("Christmas Day");
    });

    it("uses regional holidays when the state is known", () => {
      const input: DeadlineInput = {
        rawText: "innerhalb von zwei Wochen nach Erhalt",
        letterDate: "2026-05-15",
        receivedDate: "2026-05-21",
        senderType: "BUERGERAMT",
      };
      // 21 May + 2 weeks = Thu 4 Jun 2026, Corpus Christi in NRW
      expect(due({ ...input, state: "NW" }).dueDate).toBe("2026-06-05");
      expect(due({ ...input, state: "BE" }).dueDate).toBe("2026-06-04");

      const withoutState = due(input);
      expect(withoutState.dueDate).toBe("2026-06-04");
      expect(withoutState.explanation.at(-1)).toContain("public holiday in some federal states");
      expect(withoutState.explanation.at(-1)).toContain("NW");
    });
  });

  describe("other senders and starts", () => {
    it("counts from the letter date when the wording says so", () => {
      const result = due({
        rawText: "zahlbar innerhalb von 14 Tagen nach Rechnungsdatum",
        letterDate: "2026-11-05",
        senderType: "COMPANY",
      });
      expect(result.dueDate).toBe("2026-11-19");
      expect(result.isEstimate).toBe(false);
    });

    it("counts from the letter date for companies, to be on the safe side", () => {
      const result = due({
        rawText: "binnen 14 Tagen nach Erhalt",
        letterDate: "2026-11-05",
        senderType: "LANDLORD",
      });
      expect(result.dueDate).toBe("2026-11-19");
      expect(result.isEstimate).toBe(true);
      expect(result.explanation[0]).toContain("safe side");
    });

    it("counts formal delivery (Zustellung) from the letter date and mentions the envelope", () => {
      const result = due({
        rawText: "binnen zwei Wochen nach Zustellung",
        letterDate: "2026-11-10",
        senderType: "FINANZAMT",
      });
      expect(result.dueDate).toBe("2026-11-24");
      expect(result.explanation.join(" ")).toContain("yellow envelope");
    });

    it("uses the actual receipt date when it is known", () => {
      const result = due({
        rawText: MONTH_AFTER_NOTICE,
        letterDate: "2026-11-02",
        receivedDate: "2026-11-10",
        senderType: "FINANZAMT",
      });
      expect(result.dueDate).toBe("2026-12-10");
      expect(result.isEstimate).toBe(false);
    });

    it("explains when the wording names no start", () => {
      const result = due({ rawText: "binnen 14 Tagen", letterDate: "2026-11-12", senderType: "JOBCENTER" });
      // delivered Mon 16 Nov -> Mon 30 Nov
      expect(result.dueDate).toBe("2026-11-30");
      expect(result.explanation[0]).toContain("does not say when the period starts");
    });
  });

  describe("returns a reason when it cannot calculate", () => {
    it("without a letter date", () => {
      const result = computeRelativeDeadline({ rawText: MONTH_AFTER_NOTICE, letterDate: null, senderType: "FINANZAMT" });
      expect(result).toEqual({ ok: false, reason: expect.stringContaining("no date") });
    });

    it("for wording it cannot read", () => {
      const result = computeRelativeDeadline({
        rawText: "innerhalb von 5 Werktagen",
        letterDate: "2026-11-12",
        senderType: "FINANZAMT",
      });
      expect(result.ok).toBe(false);
    });

    it("for an invalid letter date", () => {
      const result = computeRelativeDeadline({ rawText: MONTH_AFTER_NOTICE, letterDate: "2026-02-30", senderType: "FINANZAMT" });
      expect(result).toEqual({ ok: false, reason: "Invalid date: 2026-02-30" });
    });
  });
});
