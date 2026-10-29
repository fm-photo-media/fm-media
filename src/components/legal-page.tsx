import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { Fragment } from "react";
import { BUSINESS } from "@/lib/business";
import { parseLegalMarkdown, type Inline } from "@/lib/legal-markdown";

// LEG-1: /privacy and /terms, rendered on the server (at build) from src/content/legal/.
// Batch 5 (design.md "Doc layout"): a sticky table of contents, a 68ch body and a sticky
// "Questions about this page?" aside. Any "[PLACEHOLDER]" left in the text is highlighted.

export function loadLegalDocument(file: "privacy.md" | "terms.md") {
  return parseLegalMarkdown(readFileSync(path.join(process.cwd(), "src/content/legal", file), "utf8"));
}

const PLACEHOLDER = /(\[[A-Z][A-Z0-9 _,.'/-]*\])/;

function TextWithPlaceholders({ text }: { text: string }) {
  return (
    <>
      {text.split(PLACEHOLDER).map((piece, index) => (PLACEHOLDER.test(piece) ? <mark key={index}>{piece}</mark> : <Fragment key={index}>{piece}</Fragment>))}
    </>
  );
}

function InlineParts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "strong") {
          return (
            <strong key={index}>
              <TextWithPlaceholders text={part.text} />
            </strong>
          );
        }
        if (part.type === "link") {
          return part.href.startsWith("/") ? (
            <Link key={index} href={part.href}>
              {part.text}
            </Link>
          ) : (
            <a key={index} href={part.href}>
              {part.text}
            </a>
          );
        }
        return <TextWithPlaceholders key={index} text={part.text} />;
      })}
    </>
  );
}

const slug = (text: string, index: number) =>
  `s${index}-${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)}`;

export function LegalPage({ file }: { file: "privacy.md" | "terms.md" }) {
  const doc = loadLegalDocument(file);
  const headings = doc.blocks.flatMap((block, index) => (block.type === "h2" ? [{ id: slug(block.text, index), text: block.text, index }] : []));
  const idFor = new Map(headings.map((heading) => [heading.index, heading.id]));

  return (
    <main id="main">
      <section className="phead" aria-labelledby="h1">
        <div className="wrap">
          <h1 className="display" id="h1">
            {doc.title}
          </h1>
        </div>
      </section>
      <div className="wrap doc">
        <nav className="doc__toc" aria-label="On this page">
          <b>On this page</b>
          {headings.map((heading) => (
            <a key={heading.id} href={`#${heading.id}`}>
              {heading.text}
            </a>
          ))}
        </nav>
        <article className="doc__body">
          {doc.blocks.map((block, index) => {
            if (block.type === "h2") {
              return (
                <h2 key={index} id={idFor.get(index)}>
                  {block.text}
                </h2>
              );
            }
            if (block.type === "ul") {
              return (
                <ul key={index}>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <InlineParts parts={item} />
                    </li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={index}>
                {block.lines.map((line, lineIndex) => (
                  <Fragment key={lineIndex}>
                    {lineIndex > 0 ? <br /> : null}
                    <InlineParts parts={line} />
                  </Fragment>
                ))}
              </p>
            );
          })}
        </article>
        <aside className="doc__aside" aria-labelledby="doc-q">
          <b className="fact" id="doc-q">
            Questions about this page?
          </b>
          <a href={`tel:${BUSINESS.phoneE164}`}>Call or text {BUSINESS.phoneDisplay}</a>
          <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
        </aside>
      </div>
    </main>
  );
}
