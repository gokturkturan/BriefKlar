import { z } from "zod";
import type { AgentIssue, LetterExtraction, ReplyBody } from "@briefklar/shared";
import { generateStructured, type StructuredResult } from "../llm/generateStructured";
import type { LLMProvider } from "../llm/LLMProvider";

export const VERIFY_REPLY_PROMPT_VERSION = "verify-reply@1";

/** The longest evidence an issue keeps (AgentIssueSchema) */
const MAX_EVIDENCE_LENGTH = 300;

export const VERIFY_REPLY_SYSTEM_PROMPT = `
You check a reply letter that another model drafted for the recipient of an official German
letter. The draft may only use facts from two sources: the analysis of the letter it answers,
and the user's own notes (any language). Report every fact of the draft that neither source
contains or that contradicts them:
- an amount, date, period, deadline, number of days or months, or reference number;
- a name, address, account, phone number or e-mail address;
- an event, reason or circumstance (an illness, a job loss, a payment made, a document sent)
  that the user did not write in the notes.

These are fine and must not be reported:
- placeholders in square brackets, e.g. [monatlicher Betrag] or [Grund];
- the letter's own date, subject and sender, and facts of the analysis;
- polite standard phrases: asking for a written confirmation of receipt, offering proof of
  income, saying that the reasons will follow, asking for a reply;
- the user's notes in other words or translated into German.
Do not judge style, tone, grammar or how strong the arguments are. Most drafts are correct; an
empty list is the normal answer.

Each issue:
1. "field" is "subject" or "paragraphs[i]" (counted from 0).
2. "problem" says in one sentence which fact is not backed by the analysis or the notes.
3. "evidence" quotes the sentence of the draft that contains it, word for word (at most 250 characters).
`.trim();

const ReplyCheckSchema = z.object({
  issues: z.array(
    z.object({
      field: z.string().min(1).describe('"subject" or "paragraphs[i]"'),
      problem: z.string().min(1).describe("Which fact is not backed by the analysis or the notes"),
      evidence: z.string().describe("The sentence of the draft that contains it"),
    }),
  ),
});

/**
 * Asks a second model (the verifier's, not the reply writer's) whether the draft states facts
 * that are neither in the analysis nor in the user's notes. Only the German text is checked:
 * the user signs that one, and the translation follows it.
 */
export async function verifyReply(params: {
  provider: LLMProvider;
  extraction: LetterExtraction;
  notes: string;
  body: Pick<ReplyBody, "subject" | "paragraphs">;
  documentId?: string;
}): Promise<StructuredResult<{ issues: AgentIssue[] }>> {
  const { extraction } = params;
  const result = await generateStructured({
    provider: params.provider,
    schema: ReplyCheckSchema,
    system: VERIFY_REPLY_SYSTEM_PROMPT,
    input: [
      {
        type: "text",
        text: [
          "Analysis of the letter:",
          JSON.stringify(
            {
              sender: extraction.sender,
              letterType: extraction.letterType,
              letterDate: extraction.letterDate,
              subject: extraction.subject,
              summary: extraction.summary,
              references: extraction.references,
              amounts: extraction.amounts,
              deadlines: extraction.deadlines,
              requiredDocuments: extraction.requiredDocuments,
            },
            null,
            2,
          ),
          "",
          "User's notes:",
          params.notes ? `"""${params.notes}"""` : "(none)",
          "",
          "Draft to check:",
          JSON.stringify({ subject: params.body.subject, paragraphs: params.body.paragraphs }, null, 2),
        ].join("\n"),
      },
    ],
    purpose: "verify-reply",
    promptVersion: VERIFY_REPLY_PROMPT_VERSION,
    documentId: params.documentId,
  });
  const issues = result.data.issues
    .filter((issue) => /^(subject|paragraphs\[\d+\])$/.test(issue.field.trim()))
    .map((issue) => ({
      field: issue.field.trim(),
      problem: issue.problem.trim(),
      evidence: issue.evidence.trim().slice(0, MAX_EVIDENCE_LENGTH),
    }));
  return { ...result, data: { issues } };
}
