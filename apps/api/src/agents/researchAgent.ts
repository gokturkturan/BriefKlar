import type { ReplyType } from "@briefklar/shared";
import { searchKnowledge, type KnowledgeHit } from "../knowledge/knowledgeBase";
import { LLMError } from "../llm/errors";
import type { ReplyCaseFile } from "./replyCaseFile";
import type { Agent } from "./types";

/** What the knowledge base is asked about each kind of reply */
export const RESEARCH_QUERIES: Record<ReplyType, string> = {
  OBJECTION: "How and by when do I file a Widerspruch or Einspruch against a decision?",
  EXTENSION_REQUEST: "Can I ask an authority for more time (Fristverlängerung)?",
  SEND_DOCUMENTS: "How do I prove that I sent documents to an authority in time?",
  INSTALLMENT_PLAN: "Can I ask to pay a debt in instalments (Ratenzahlung, Stundung)?",
  QUESTION: "Where can I get free advice about an official letter?",
};

/** Sources shown under the chat's answer: the best match and those almost as close */
const SOURCE_SIMILARITY_MARGIN = 0.05;
const MAX_SOURCES = 2;

/**
 * Finds official sources about the kind of reply in the knowledge base, so the user can read
 * how it works (form, deadline, proof of sending). The sources are shown next to the draft and
 * are not quoted in it: the draft makes no legal arguments. One embedding request; not needed
 * for the draft, so a failure only leaves the sources out.
 */
export function createResearchAgent(
  search: (query: string, documentId: string) => Promise<KnowledgeHit[]> = (query, documentId) =>
    searchKnowledge(query, { documentId }),
): Agent<ReplyCaseFile> {
  return {
    name: "research",
    async handle(_task, { caseFile }) {
      let hits: KnowledgeHit[];
      try {
        hits = await search(RESEARCH_QUERIES[caseFile.type], caseFile.documentId);
      } catch (err) {
        if (!(err instanceof LLMError)) throw err;
        return { kind: "result", wrote: [], summary: `No sources: ${err.message.slice(0, 200)}` };
      }
      const best = hits[0]?.similarity ?? 0;
      caseFile.sources = hits
        .filter((hit) => hit.similarity >= best - SOURCE_SIMILARITY_MARGIN)
        .slice(0, MAX_SOURCES)
        .map((hit) => ({ title: hit.title, url: hit.sourceUrl }));
      return {
        kind: "result",
        wrote: [],
        summary: `${caseFile.sources.length} source(s): ${caseFile.sources.map((s) => s.title).join("; ") || "none"}`,
      };
    },
  };
}

export const researchAgent = createResearchAgent();
