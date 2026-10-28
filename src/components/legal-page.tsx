import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { Fragment } from "react";
import { parseLegalMarkdown, type Inline } from "@/lib/legal-markdown";

// LEG-1: /privacy and /terms, rendered on the server (at build) from src/content/legal/.
// Batch 5 restyles these; for now they follow the site's existing type and colours.

export function loadLegalDocument(file: "privacy.md" | "terms.md") {
  return parseLegalMarkdown(readFileSync(path.join(process.cwd(), "src/content/legal", file), "utf8"));
}

function InlineParts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "strong") return <strong key={index} className="font-semibold text-ink">{part.text}</strong>;
        if (part.type === "link") {
          return part.href.startsWith("/") ? (
            <Link key={index} href={part.href} className="focus-ring font-semibold text-ink underline">
              {part.text}
            </Link>
          ) : (
            <a key={index} href={part.href} className="focus-ring font-semibold text-ink underline">
              {part.text}
            </a>
          );
        }
        return <Fragment key={index}>{part.text}</Fragment>;
      })}
    </>
  );
}

export function LegalPage({ file }: { file: "privacy.md" | "terms.md" }) {
  const doc = loadLegalDocument(file);

  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">{doc.title}</h1>
      <div className="mt-8 grid gap-5 text-base leading-7 text-ink/80">
        {doc.blocks.map((block, index) => {
          if (block.type === "h2") {
            return (
              <h2 key={index} className="mt-6 font-serif text-2xl text-ink">
                {block.text}
              </h2>
            );
          }
          if (block.type === "ul") {
            return (
              <ul key={index} className="grid list-disc gap-2 pl-6">
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
      </div>
    </main>
  );
}
