import { describe, expect, it } from "vitest";
import { planDeadlineReminders } from "./deadlineReminders";

const row = (kind: string, sourceText: string, dueDate: string) => ({
  kind,
  sourceText,
  dueDate: new Date(`${dueDate}T00:00:00Z`),
});

describe("planDeadlineReminders", () => {
  const today = "2026-12-07";

  it("reminds three days before the due date", () => {
    expect(planDeadlineReminders([row("PAYMENT", "bis zum 20.12.2026", "2026-12-20")], today)).toEqual([
      { deadlineKey: "PAYMENT|bis zum 20.12.2026", deadlineKind: "PAYMENT", dueDate: "2026-12-20", remindOn: "2026-12-17" },
    ]);
  });

  it("reminds today when the deadline is closer than three days, also on the due date itself", () => {
    const plan = planDeadlineReminders(
      [row("RESPONSE", "binnen 14 Tagen", "2026-12-08"), row("PAYMENT", "sofort", "2026-12-07")],
      today,
    );
    expect(plan.map((p) => p.remindOn)).toEqual([today, today]);
  });

  it("skips deadlines that are over", () => {
    expect(planDeadlineReminders([row("OBJECTION", "innerhalb eines Monats", "2026-12-06")], today)).toEqual([]);
  });

  it("keeps one reminder per deadline wording, for the earlier date", () => {
    const plan = planDeadlineReminders(
      [row("PAYMENT", "zahlbar bis", "2027-01-15"), row("PAYMENT", "zahlbar bis", "2026-12-31")],
      today,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ dueDate: "2026-12-31", remindOn: "2026-12-28" });
  });

  it("counts back across a month and year boundary", () => {
    const [plan] = planDeadlineReminders([row("PAYMENT", "bis 02.01.2027", "2027-01-02")], "2026-12-20");
    expect(plan?.remindOn).toBe("2026-12-30");
  });
});
