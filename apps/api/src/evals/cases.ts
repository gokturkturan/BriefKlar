import type { DeadlineKind, LetterType, SenderType } from "@briefklar/shared";

/**
 * The evaluation set: fictional letters in `letters/` and what a correct analysis contains.
 * Only fields with one right answer are checked. Urgency and the wording of the summary and
 * the tasks are left out: they have no single correct value.
 *
 * Due dates are what the deadline engine computes from a correctly copied wording, so a case
 * checks the whole path: the model copies the wording, code computes the date.
 */
export interface ExpectedDeadline {
  /** One kind, or several that are all acceptable */
  kind: DeadlineKind | DeadlineKind[];
  dueDate: string;
}

export interface EvalCase {
  /** File name in letters/ (.txt, .pdf, .jpg or .png) */
  file: string;
  isOfficialLetter: boolean;
  senderType?: SenderType;
  letterType?: LetterType | LetterType[];
  letterDate?: string | null;
  objectionPossible?: boolean;
  /** Amounts that must be found; [] = the letter has no amounts */
  amounts?: number[];
  /** Reference numbers that must be found (spaces are ignored) */
  references?: string[];
  /** Deadlines with a due date; [] = the letter has none */
  deadlines?: ExpectedDeadline[];
  /** Other dates in the letter that may be listed as a deadline without being wrong */
  optionalDueDates?: string[];
}

export const EVAL_CASES: EvalCase[] = [
  {
    file: "01-finanzamt-einkommensteuer.txt",
    isOfficialLetter: true,
    senderType: "FINANZAMT",
    letterType: "BESCHEID",
    letterDate: "2026-09-14",
    objectionPossible: true,
    amounts: [1234.56],
    references: ["214/5678/9012"],
    deadlines: [
      { kind: "PAYMENT", dueDate: "2026-10-19" },
      // One month after deemed delivery on 18.09., ends on a Sunday, moves to Monday
      { kind: "OBJECTION", dueDate: "2026-10-19" },
    ],
  },
  {
    file: "02-jobcenter-mitwirkung.txt",
    isOfficialLetter: true,
    senderType: "JOBCENTER",
    letterType: "AUFFORDERUNG",
    letterDate: "2026-10-05",
    objectionPossible: false,
    amounts: [],
    references: ["12345BG0098765"],
    deadlines: [{ kind: "DOCUMENTS", dueDate: "2026-10-26" }],
  },
  {
    file: "03-rundfunkbeitrag-zahlungserinnerung.txt",
    isOfficialLetter: true,
    senderType: "RUNDFUNKBEITRAG",
    letterType: "MAHNUNG",
    letterDate: "2026-08-03",
    objectionPossible: false,
    amounts: [55.08],
    references: ["456789123"],
    // Two weeks after deemed delivery on 07.08.
    deadlines: [{ kind: "PAYMENT", dueDate: "2026-08-21" }],
  },
  {
    file: "04-familienkasse-rueckforderung.txt",
    isOfficialLetter: true,
    senderType: "FAMILIENKASSE",
    letterType: "BESCHEID",
    letterDate: "2026-07-20",
    objectionPossible: true,
    amounts: [1020],
    references: ["245FK123456"],
    deadlines: [
      { kind: "PAYMENT", dueDate: "2026-08-24" },
      { kind: "OBJECTION", dueDate: "2026-08-24" },
    ],
  },
  {
    file: "05-auslaenderbehoerde-termin.txt",
    isOfficialLetter: true,
    senderType: "AUSLAENDERBEHOERDE",
    letterType: "TERMIN",
    letterDate: "2026-10-15",
    objectionPossible: false,
    amounts: [98],
    references: ["AB-2026-447812"],
    // "drei Werktage vorher" has no date on purpose: working days are not computed
    deadlines: [{ kind: "APPOINTMENT", dueDate: "2026-11-12" }],
    optionalDueDates: ["2026-11-30"],
  },
  {
    file: "06-krankenkasse-beitragsrueckstand.txt",
    isOfficialLetter: true,
    senderType: "KRANKENKASSE",
    letterType: "MAHNUNG",
    letterDate: "2026-09-10",
    objectionPossible: false,
    amounts: [424.3],
    references: ["A123456789"],
    deadlines: [{ kind: "PAYMENT", dueDate: "2026-09-30" }],
  },
  {
    file: "07-vermieter-betriebskosten.txt",
    isOfficialLetter: true,
    senderType: "LANDLORD",
    letterType: ["INVOICE", "INFO", "OTHER"],
    letterDate: "2026-06-12",
    objectionPossible: false,
    amounts: [386.4],
    // Not an authority: counted from the letter date (12.07. is a Sunday)
    deadlines: [{ kind: "PAYMENT", dueDate: "2026-07-13" }],
    optionalDueDates: ["2026-08-01"],
  },
  {
    file: "08-arbeitgeber-kuendigung.txt",
    isOfficialLetter: true,
    senderType: "EMPLOYER",
    letterType: "KUENDIGUNG",
    letterDate: "2026-03-27",
    amounts: [],
    deadlines: [{ kind: ["OTHER", "RESPONSE"], dueDate: "2026-03-30" }],
    optionalDueDates: ["2026-04-30"],
  },
  {
    file: "09-amtsgericht-mahnbescheid.txt",
    isOfficialLetter: true,
    senderType: "COURT",
    letterType: ["BESCHEID", "MAHNUNG", "OTHER"],
    letterDate: "2026-05-04",
    objectionPossible: true,
    amounts: [285.9],
    references: ["26-1234567-0-5"],
    // Two weeks from formal delivery, counted from the letter date while the delivery date is unknown
    deadlines: [{ kind: ["OBJECTION", "PAYMENT", "RESPONSE"], dueDate: "2026-05-18" }],
  },
  {
    file: "10-mobilfunk-rechnung.txt",
    isOfficialLetter: true,
    senderType: "COMPANY",
    letterType: "INVOICE",
    letterDate: "2026-07-01",
    amounts: [34.19],
    references: ["70012345", "R-2026-06-559102"],
    deadlines: [
      { kind: "PAYMENT", dueDate: "2026-07-15" },
      { kind: ["OBJECTION", "OTHER", "RESPONSE"], dueDate: "2026-08-26" },
    ],
  },
  {
    file: "11-private-einladung.txt",
    isOfficialLetter: false,
  },
];
