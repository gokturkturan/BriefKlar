import { describe, expect, it } from "vitest";
import { EMBEDDING_DIMENSIONS } from "../llm/LLMProvider";
import { normalize } from "../llm/vectors";
import { KNOWLEDGE_ENTRIES } from "./entries";
import { contentHash, embeddingText, toVectorLiteral } from "./knowledgeBase";

describe("knowledge entries", () => {
  it("have unique slugs", () => {
    const slugs = KNOWLEDGE_ENTRIES.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("each name an https source and stay short enough to quote in a chat answer", () => {
    for (const entry of KNOWLEDGE_ENTRIES) {
      expect(entry.sourceUrl, entry.slug).toMatch(/^https:\/\/www\.[a-z-]+\.de\//);
      expect(entry.slug).toMatch(/^[a-z0-9-]+$/);
      expect(entry.content.length, entry.slug).toBeLessThan(1000);
      expect(entry.title.length, entry.slug).toBeLessThan(100);
    }
  });
});

describe("contentHash", () => {
  const entry = KNOWLEDGE_ENTRIES[0]!;

  it("stays the same for the same entry and model", () => {
    expect(contentHash(entry, "model-a")).toBe(contentHash({ ...entry }, "model-a"));
  });

  it("changes with the text or the embedding model, so the entry is embedded again", () => {
    const base = contentHash(entry, "model-a");
    expect(contentHash({ ...entry, content: `${entry.content} More.` }, "model-a")).not.toBe(base);
    expect(contentHash(entry, "model-b")).not.toBe(base);
  });
});

describe("embeddingText", () => {
  it("puts the title before the content", () => {
    expect(embeddingText({ title: "Widerspruch", content: "One month." })).toBe("Widerspruch\n\nOne month.");
  });
});

describe("toVectorLiteral", () => {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i % 3) - 1);

  it("writes pgvector's text format", () => {
    const literal = toVectorLiteral(vector);
    expect(literal.startsWith("[-1,0,1,-1")).toBe(true);
    expect(literal.split(",")).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("rejects vectors of the wrong size or with invalid numbers", () => {
    expect(() => toVectorLiteral([1, 2, 3])).toThrow(/dimensions/);
    expect(() => toVectorLiteral(vector.map((v, i) => (i === 5 ? Number.NaN : v)))).toThrow(/not a number/);
  });
});

describe("normalize", () => {
  it("scales a vector to length 1", () => {
    expect(normalize([3, 4])).toEqual([0.6, 0.8]);
  });

  it("refuses a zero vector", () => {
    expect(() => normalize([0, 0])).toThrow();
  });
});
