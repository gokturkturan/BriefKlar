import type { AgentName, AgentPhase, ChatReplyDraftDto, ExplanationLanguage } from "@briefklar/shared";
import { AgentLimitError } from "../agents/orchestrator";
import { runReply, type ReplyAgents } from "../agents/writeReply";
import { toIsoDate, todayInGermany } from "../deadlines/calendarDate";
import { requireExtraction } from "../documents/extractions";
import { prisma } from "../lib/prisma";
import { LLMError } from "../llm/errors";
import { LLMValidationError } from "../llm/generateStructured";
import { replyWarnings } from "../replies/composeReplyLetter";
import { UNSUPPORTED_PLACEHOLDER } from "../replies/replyFacts";
import type { DelegateRequest, ToolOutput } from "./tools";

/**
 * The delegate tool: the chat hands a reply draft to the reply writer through the orchestrator
 * (agents/writeReply.ts). The tool result tells the chat model what to say; the draft itself is
 * stored and shown in the reply section, linked under the answer.
 */
export async function delegateToAgent(
  documentId: string,
  language: ExplanationLanguage,
  { input }: DelegateRequest,
  onAgent: (agent: AgentName, phase: AgentPhase) => void,
  agents?: ReplyAgents,
): Promise<ToolOutput> {
  let outcome;
  try {
    outcome = await runReply(
      {
        documentId,
        type: input.type,
        notes: input.notes.trim(),
        language,
        trigger: "CHAT",
        reason: `The user asked the chat for a ${input.type} draft`,
        onAgent,
      },
      agents ? { agents } : undefined,
    );
  } catch (err) {
    if (!(err instanceof LLMError) && !(err instanceof LLMValidationError) && !(err instanceof AgentLimitError))
      throw err;
    console.error(`Reply draft from the chat failed for ${documentId}:`, err);
    return { ok: false, result: { error: "The draft could not be written. Suggest trying again in a moment." } };
  }

  if (outcome.status === "question") {
    return {
      ok: true,
      result: { status: "needs_info", type: input.type, missing: outcome.missing, ask: outcome.text },
    };
  }

  const { draft } = outcome;
  const [extraction, deadlines] = await Promise.all([
    requireExtraction(documentId),
    prisma.deadline.findMany({ where: { documentId }, select: { kind: true, dueDate: true } }),
  ]);
  const warnings = replyWarnings({
    type: input.type,
    extraction,
    deadlines: deadlines.map((d) => ({ kind: d.kind, dueDate: toIsoDate(d.dueDate) })),
    contentDe: draft.contentDe,
    today: todayInGermany(),
  });
  const replyDraft: ChatReplyDraftDto = { id: draft.id, type: input.type };
  return {
    ok: true,
    result: {
      status: "draft_saved",
      type: input.type,
      warnings,
      placeholdersToFill: [...new Set(draft.contentDe.match(/\[[^\]\n]+\]/g) ?? [])],
      ...(outcome.replaced.length > 0
        ? { note: `Numbers that are not in the letter became ${UNSUPPORTED_PLACEHOLDER}; the user fills them in.` }
        : {}),
    },
    sources: outcome.sources,
    replyDraft,
  };
}
