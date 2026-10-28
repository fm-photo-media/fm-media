import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BUSINESS } from "./business";
import { inlineText, parseInline, parseLegalMarkdown, safeHref } from "./legal-markdown";
import { firstShootDroneOffer } from "./promotion";

const read = (name: string) => readFileSync(path.join(process.cwd(), "src/content/legal", name), "utf8");

test("the page text is everything below the # heading; the HTML comment is dropped", () => {
  const doc = parseLegalMarkdown("<!--\nnot page text\n-->\n\n# Privacy Policy\n\n**Effective date:** today\n\n## 1. One\n\nHello\n");
  assert.equal(doc.title, "Privacy Policy");
  assert.deepEqual(
    doc.blocks.map((b) => b.type),
    ["p", "h2", "p"]
  );
  assert.ok(!JSON.stringify(doc).includes("not page text"));
});

test("lists, multi-line paragraphs, bold and links", () => {
  const doc = parseLegalMarkdown("# T\n\n- **a** one\n- see [Terms](/terms)\n\nLine 1\nLine 2\n");
  assert.equal(doc.blocks[0].type, "ul");
  const list = doc.blocks[0] as { type: "ul"; items: ReturnType<typeof parseInline>[] };
  assert.deepEqual(list.items[0][0], { type: "strong", text: "a" });
  assert.deepEqual(list.items[1][1], { type: "link", href: "/terms", text: "Terms" });
  const para = doc.blocks[1] as { type: "p"; lines: ReturnType<typeof parseInline>[] };
  assert.equal(para.lines.length, 2, "each source line keeps its own line (the contact block)");
});

test("only safe link targets become links", () => {
  for (const ok of ["/privacy", "/terms", "https://fm-media.org", "mailto:a@b.co", "tel:+13123755209"]) assert.equal(safeHref(ok), ok, ok);
  for (const bad of ["javascript:alert(1)", "//evil.example", "data:text/html,x", "http://x", " /terms"]) assert.equal(safeHref(bad), null, bad);
  assert.deepEqual(parseInline("[x](javascript:alert(1))"), [{ type: "text", text: "[x](javascript:alert(1))" }]);
});

test("the shipped privacy policy matches legal/privacy.md's facts (24 months: Ship condition A1)", () => {
  const doc = parseLegalMarkdown(read("privacy.md"));
  assert.equal(doc.title, "Privacy Policy");
  const text = inlineText(doc);
  assert.match(text, /up to 24 months after we receive them, then delete them/);
  assert.match(text, /Effective date: October 28, 2026/);
  assert.ok(text.includes(BUSINESS.email) && text.includes(BUSINESS.phoneDisplay));
  assert.equal(doc.blocks.filter((b) => b.type === "h2").length, 13);
});

test("Ship condition C: the terms' offer text is identical to promotion.ts", () => {
  const doc = parseLegalMarkdown(read("terms.md"));
  assert.equal(doc.title, "Terms of Service");
  assert.ok(inlineText(doc).includes(firstShootDroneOffer.terms));
  assert.equal(doc.blocks.filter((b) => b.type === "h2").length, 14);
});

test("no unverified credentials or business facts on the legal pages", () => {
  for (const file of ["privacy.md", "terms.md"]) {
    const text = inlineText(parseLegalMarkdown(read(file)));
    assert.doesNotMatch(text, /\bFAA\b|Part 107|licensed|insured|certified|FM Media,? (?:LLC|Inc)/, file);
  }
});

test("the business identity is only the known facts (batch4-copy section 3)", () => {
  assert.deepEqual(BUSINESS, {
    name: "FM Media",
    owner: "Francisco Martinez",
    tagline: "Real estate photography and video in Chicagoland",
    serviceArea: "Chicagoland",
    phoneDisplay: "(312) 375-5209",
    phoneE164: "+13123755209",
    email: "femartinez211@gmail.com"
  });
});

test("hardening: a backslash right after the leading slash is refused, like //", () => {
  const backslash = String.fromCharCode(92);
  for (const bad of [`/${backslash}evil.example`, `/${backslash}/evil.example`, "//evil.example"]) assert.equal(safeHref(bad), null, bad);
  assert.equal(safeHref("/privacy"), "/privacy");
});

test("legal pages: the phone number and email become tel: and mailto: links, text unchanged", () => {
  const parts = parseInline("Email femartinez211@gmail.com or call or text (312) 375-5209. We may need to confirm.");
  assert.deepEqual(parts, [
    { type: "text", text: "Email " },
    { type: "link", href: "mailto:femartinez211@gmail.com", text: "femartinez211@gmail.com" },
    { type: "text", text: " or call or text " },
    { type: "link", href: "tel:+13123755209", text: "(312) 375-5209" },
    { type: "text", text: ". We may need to confirm." }
  ]);
  // Bold text and existing links are left alone.
  assert.deepEqual(parseInline("**(312) 375-5209**"), [{ type: "strong", text: "(312) 375-5209" }]);

  for (const file of ["privacy.md", "terms.md"]) {
    const doc = parseLegalMarkdown(read(file));
    const links = doc.blocks.flatMap((b) => (b.type === "p" ? b.lines.flat() : b.type === "ul" ? b.items.flat() : [])).filter((p) => p.type === "link");
    assert.ok(links.some((l) => l.type === "link" && l.href === "tel:+13123755209"), `${file} tel`);
    assert.ok(links.some((l) => l.type === "link" && l.href === "mailto:femartinez211@gmail.com"), `${file} mailto`);
    // The markdown source itself is untouched: no link syntax around them.
    assert.ok(!read(file).includes("](tel:") && !read(file).includes("](mailto:"), file);
  }
});
