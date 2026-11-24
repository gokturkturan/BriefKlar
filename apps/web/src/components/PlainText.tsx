import type { ReactNode } from "react";

const stripBold = (line: string) => line.replace(/\*\*/g, "");

/**
 * Renders the small text format the explanation prompt asks for: "## " headings,
 * "- " list items and paragraphs. Built from React elements, so model output is never
 * inserted as HTML.
 */
export function PlainText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push(<p key={blocks.length}>{paragraph.join(" ")}</p>);
      paragraph = [];
    }
    if (list.length > 0) {
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-1 ps-5">
          {list.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("#")) {
      flush();
      blocks.push(
        <h4 key={blocks.length} className="pt-2 font-semibold text-slate-900">
          {stripBold(line.replace(/^#+\s*/, ""))}
        </h4>,
      );
    } else if (/^[-*•]\s/.test(line)) {
      if (paragraph.length > 0) flush();
      list.push(stripBold(line.replace(/^[-*•]\s+/, "")));
    } else if (line === "") {
      flush();
    } else {
      if (list.length > 0) flush();
      paragraph.push(stripBold(line));
    }
  }
  flush();

  return <div className="space-y-2 leading-relaxed text-slate-800">{blocks}</div>;
}
