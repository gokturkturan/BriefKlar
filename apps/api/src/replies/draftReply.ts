import {
  ReplyBodySchema,
  type ExplanationLanguage,
  type LetterExtraction,
  type ReplyBody,
  type ReplyType,
} from "@briefklar/shared";
import {
  REPLY_DRAFT_PROMPT_VERSION,
  REPLY_DRAFT_SYSTEM_PROMPT,
  replyDraftInput,
} from "./draftReplyPrompt";
import { generateStructured, type StructuredResult } from "../llm/generateStructured";
import { llm } from "../llm/index";

/** The model only writes the body; composeReplyLetter builds the letter around it */
export async function draftReply(params: {
  documentId: string;
  type: ReplyType;
  extraction: LetterExtraction;
  notes: string;
  language: ExplanationLanguage;
}): Promise<StructuredResult<ReplyBody>> {
  return generateStructured({
    provider: llm,
    schema: ReplyBodySchema,
    system: REPLY_DRAFT_SYSTEM_PROMPT,
    input: [{ type: "text", text: replyDraftInput(params) }],
    purpose: "reply-draft",
    promptVersion: REPLY_DRAFT_PROMPT_VERSION,
    documentId: params.documentId,
  });
}
