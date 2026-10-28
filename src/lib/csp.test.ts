import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

type HeaderRule = { headers: { key: string; value: string }[] };

async function csp() {
  const configUrl = pathToFileURL(path.join(process.cwd(), "next.config.mjs")).href;
  const config = (await import(configUrl)).default as { headers: () => Promise<HeaderRule[]> };
  const rules = await config.headers();
  const header = rules.flatMap((r) => r.headers).find((h) => h.key === "Content-Security-Policy");
  assert.ok(header, "CSP header is set");
  const directives: Record<string, string[]> = {};
  for (const part of header.value.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    directives[name] = sources;
  }
  return directives;
}

test("QA-21: connect-src allows the Blob client-upload API (vercel.com/api/blob/ only)", async () => {
  const connect = (await csp())["connect-src"];
  assert.ok(connect.includes("https://vercel.com/api/blob/"), connect.join(" "));
  // Narrow: a path prefix, never the whole vercel.com origin or a wider wildcard.
  assert.ok(!connect.includes("https://vercel.com"), "no bare vercel.com origin");
  assert.ok(!connect.some((s) => s.includes("*.vercel.com") || s === "https:" || s === "*"), "no wide wildcards");
});
