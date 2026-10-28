// LEG-1: a tiny, dependency-free reader for the legal pages (src/content/legal/*.md,
// copied from the studio's legal/ folder). It understands only what those files use:
// one "# " title, "## " headings, "- " lists, paragraphs, **bold** and [text](link).
// The output is plain data rendered as React elements, never as raw HTML.

import { BUSINESS } from "./business";

export type Inline = { type: "text"; text: string } | { type: "strong"; text: string } | { type: "link"; href: string; text: string };
export type Block = { type: "h2"; text: string } | { type: "p"; lines: Inline[][] } | { type: "ul"; items: Inline[][] };
export type LegalDocument = { title: string; blocks: Block[] };

/** Only same-site paths, https, mailto: and tel: become links. "//" and "/\" are refused (other hosts). */
export function safeHref(href: string) {
  if (/^\/(?![\/\\])/.test(href)) return href;
  if (/^(?:https:\/\/|mailto:|tel:)[^\s]+$/.test(href)) return href;
  return null;
}

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

// Batch 4 follow-up (4c): the business phone number and email, written as plain text in
// the markdown, are made clickable when rendered. Only these exact strings.
const CONTACT_LINKS: ReadonlyArray<{ text: string; href: string }> = [
  { text: BUSINESS.phoneDisplay, href: `tel:${BUSINESS.phoneE164}` },
  { text: BUSINESS.email, href: `mailto:${BUSINESS.email}` }
];

function linkContacts(parts: Inline[]): Inline[] {
  return parts.flatMap((part) => {
    if (part.type !== "text") return [part];
    let pieces: Inline[] = [part];
    for (const contact of CONTACT_LINKS) {
      pieces = pieces.flatMap((piece) => {
        if (piece.type !== "text" || !piece.text.includes(contact.text)) return [piece];
        const out: Inline[] = [];
        piece.text.split(contact.text).forEach((chunk, index) => {
          if (index > 0) out.push({ type: "link", href: contact.href, text: contact.text });
          if (chunk) out.push({ type: "text", text: chunk });
        });
        return out;
      });
    }
    return pieces;
  });
}

export function parseInline(source: string): Inline[] {
  return linkContacts(parseMarkdownInline(source));
}

function parseMarkdownInline(source: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  const pushText = (text: string) => {
    if (!text) return;
    const previous = parts[parts.length - 1];
    if (previous?.type === "text") previous.text += text;
    else parts.push({ type: "text", text });
  };

  for (const match of Array.from(source.matchAll(INLINE))) {
    const index = match.index ?? 0;
    pushText(source.slice(last, index));
    if (match[1] !== undefined) {
      parts.push({ type: "strong", text: match[1] });
    } else {
      const href = safeHref(match[3]);
      if (href) parts.push({ type: "link", href, text: match[2] });
      else pushText(match[0]);
    }
    last = index + match[0].length;
  }
  pushText(source.slice(last));
  return parts;
}

export function parseLegalMarkdown(source: string): LegalDocument {
  const lines = source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const titleIndex = lines.findIndex((line) => line.startsWith("# "));
  if (titleIndex === -1) throw new Error("legal page has no # title");

  const title = lines[titleIndex].slice(2).trim();
  const blocks: Block[] = [];
  let paragraph: Inline[][] | null = null;
  let list: Inline[][] | null = null;
  const close = () => {
    paragraph = null;
    list = null;
  };

  for (const raw of lines.slice(titleIndex + 1)) {
    const line = raw.trim();
    if (!line) {
      close();
    } else if (line.startsWith("## ")) {
      close();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("- ")) {
      paragraph = null;
      if (!list) {
        list = [];
        blocks.push({ type: "ul", items: list });
      }
      list.push(parseInline(line.slice(2).trim()));
    } else {
      list = null;
      if (!paragraph) {
        paragraph = [];
        blocks.push({ type: "p", lines: paragraph });
      }
      paragraph.push(parseInline(line));
    }
  }

  return { title, blocks };
}

/** The visible text of a document, for tests and checks. */
export function inlineText(doc: LegalDocument) {
  const text = (parts: Inline[]) => parts.map((part) => part.text).join("");
  return doc.blocks
    .map((block) => {
      if (block.type === "h2") return block.text;
      if (block.type === "p") return block.lines.map(text).join("\n");
      return block.items.map(text).join("\n");
    })
    .join("\n\n");
}
