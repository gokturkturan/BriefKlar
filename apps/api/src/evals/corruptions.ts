import type { LetterExtraction } from "@briefklar/shared";

/**
 * Deliberate errors put into a correct analysis, to measure whether the verifier catches them
 * (the "broken analysis" set). Each one changes one field the way a misreading would.
 */
export interface Corruption {
  name: string;
  /** Top-level field the verifier must name to count as caught */
  field: keyof LetterExtraction;
  apply(extraction: LetterExtraction): LetterExtraction;
}

const copy = (extraction: LetterExtraction): LetterExtraction => structuredClone(extraction);

function shiftDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Every error that fits this analysis (an amount can only be wrong if there is one) */
export function corruptionsFor(extraction: LetterExtraction): Corruption[] {
  const list: Corruption[] = [];
  const firstAmount = extraction.amounts[0];
  if (firstAmount) {
    list.push({
      name: "amount ×10",
      field: "amounts",
      apply: (e) => {
        const c = copy(e);
        c.amounts[0].value = firstAmount.value === 0 ? 100 : Math.round(firstAmount.value * 1000) / 100;
        return c;
      },
    });
  }
  if (extraction.deadlines.length > 0) {
    list.push({
      name: "deadline left out",
      field: "deadlines",
      apply: (e) => ({ ...copy(e), deadlines: e.deadlines.slice(1) }),
    });
  }
  const relative = extraction.deadlines.findIndex((d) => d.explicitDate === null);
  if (relative >= 0) {
    list.push({
      name: "date invented for relative wording",
      field: "deadlines",
      apply: (e) => {
        const c = copy(e);
        c.deadlines[relative].explicitDate = shiftDate(e.letterDate ?? "2026-10-01", 14);
        return c;
      },
    });
  }
  const reference = extraction.references.findIndex((r) => /\d/.test(r.value));
  if (reference >= 0) {
    list.push({
      name: "reference digit changed",
      field: "references",
      apply: (e) => {
        const c = copy(e);
        c.references[reference].value = e.references[reference].value.replace(/\d/, (d) => String((Number(d) + 3) % 10));
        return c;
      },
    });
  }
  const letterDate = extraction.letterDate;
  if (letterDate) {
    list.push({
      name: "letter date shifted",
      field: "letterDate",
      apply: (e) => ({ ...copy(e), letterDate: shiftDate(letterDate, 3) }),
    });
  }
  list.push({
    name: "objection flipped",
    field: "objectionPossible",
    apply: (e) => ({ ...copy(e), objectionPossible: !e.objectionPossible }),
  });
  list.push({
    name: "wrong sender type",
    field: "sender",
    apply: (e) => {
      const c = copy(e);
      c.sender.type = e.sender.type === "FINANZAMT" ? "JOBCENTER" : "FINANZAMT";
      return c;
    },
  });
  return list;
}

/** Up to `count` errors for one letter; `offset` rotates the choice, so every kind is tried across letters */
export function pickCorruptions(extraction: LetterExtraction, count: number, offset: number): Corruption[] {
  const all = corruptionsFor(extraction);
  if (all.length <= count) return all;
  return Array.from({ length: count }, (_, i) => all[(offset + i) % all.length]);
}
