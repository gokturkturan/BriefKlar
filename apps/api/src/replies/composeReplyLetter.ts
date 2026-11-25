import type { LetterExtraction, ReplyBody, ReplyType, SenderType } from "@briefklar/shared";
import { isIsoDate, type IsoDate } from "../deadlines/calendarDate";

/**
 * Builds the German letter around the body the model wrote. Everything that must be exactly
 * right (reference numbers, dates, the sender's name, the formal frame) comes from code and
 * the checked extraction, not from the model.
 */

/** Tax and child benefit offices use Einspruch (§ 347 AO), other authorities Widerspruch (§ 69 SGG, § 68 VwGO) */
const EINSPRUCH_SENDERS: ReadonlySet<SenderType> = new Set<SenderType>(["FINANZAMT", "FAMILIENKASSE"]);

export function objectionTerm(senderType: SenderType): "Einspruch" | "Widerspruch" {
  return EINSPRUCH_SENDERS.has(senderType) ? "Einspruch" : "Widerspruch";
}

/** "2026-03-02" -> "02.03.2026" */
export function formatGermanDate(date: IsoDate): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

/** Today's date in Germany, whatever the server's time zone */
export function todayInGermany(now = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(now);
}

export interface ComposeInput {
  type: ReplyType;
  extraction: LetterExtraction;
  body: Pick<ReplyBody, "subject" | "paragraphs">;
  /** Date of the reply */
  date: IsoDate;
}

export function composeReplyLetter({ type, extraction, body, date }: ComposeInput): string {
  const lines: string[] = [
    "[Ihr Vor- und Nachname]",
    "[Straße und Hausnummer]",
    "[PLZ und Ort]",
    "",
    extraction.sender.name.trim() || "[Name des Absenders]",
    "[Anschrift laut Schreiben]",
    "",
    `[Ort], ${formatGermanDate(date)}`,
    "",
    body.subject.trim(),
  ];

  for (const ref of extraction.references) {
    lines.push(`${ref.label.trim()}: ${ref.value.trim()}`);
  }
  if (extraction.letterDate && isIsoDate(extraction.letterDate)) {
    lines.push(`Ihr Schreiben vom ${formatGermanDate(extraction.letterDate)}`);
  }

  lines.push("", "Sehr geehrte Damen und Herren,", "");
  for (const paragraph of body.paragraphs) {
    const text = paragraph.trim();
    if (text) lines.push(text, "");
  }
  lines.push("Mit freundlichen Grüßen", "", "", "[Unterschrift]", "[Ihr Vor- und Nachname]");

  if (type === "SEND_DOCUMENTS" && extraction.requiredDocuments.length > 0) {
    lines.push("", "Anlagen:", ...extraction.requiredDocuments.map((doc) => `- ${doc.trim()}`));
  }

  return lines.join("\n");
}

/** Distinct [placeholders] the user still has to fill in */
export function findPlaceholders(text: string): string[] {
  return [...new Set(text.match(/\[[^\][\n]{2,80}\]/g) ?? [])];
}

export interface WarningInput {
  type: ReplyType;
  extraction: LetterExtraction;
  /** Computed deadlines of the letter */
  deadlines: { kind: string; dueDate: IsoDate }[];
  contentDe: string;
  today: IsoDate;
}

/** Things to check before sending, decided by code */
export function replyWarnings({ type, extraction, deadlines, contentDe, today }: WarningInput): string[] {
  const warnings: string[] = [];

  if (type === "OBJECTION") {
    if (!extraction.objectionPossible) {
      warnings.push(
        "The letter does not mention a right to object. Check whether an objection is possible at all.",
      );
    }
    const objectionDeadline = deadlines
      .filter((d) => d.kind === "OBJECTION")
      .map((d) => d.dueDate)
      .sort()[0];
    if (objectionDeadline && objectionDeadline < today) {
      warnings.push(
        `The objection deadline (${formatGermanDate(objectionDeadline)}) may have passed. ` +
          "Get advice quickly: late objections are usually rejected.",
      );
    } else if (objectionDeadline) {
      warnings.push(
        `It must arrive by ${formatGermanDate(objectionDeadline)}. Sign it and keep proof that you sent it ` +
          "(e.g. Einwurf-Einschreiben or a fax report).",
      );
    }
  }

  if (type === "EXTENSION_REQUEST" || type === "INSTALLMENT_PLAN") {
    warnings.push("This is a request: the deadline stays in place until the sender agrees.");
  }

  const placeholders = findPlaceholders(contentDe);
  if (placeholders.length > 0) {
    warnings.push(`Fill in before sending: ${placeholders.join(", ")}`);
  }

  return warnings;
}
