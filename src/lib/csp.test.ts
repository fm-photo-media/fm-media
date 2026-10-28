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

async function config() {
  const configUrl = pathToFileURL(path.join(process.cwd(), "next.config.mjs")).href;
  return (await import(configUrl)).default as {
    images: { remotePatterns: { protocol?: string; hostname: string; pathname?: string }[] };
  };
}

test("LEG-9: no stock-photo host in the CSP img-src", async () => {
  const img = (await csp())["img-src"];
  assert.ok(!img.some((s) => /unsplash|pexels|pixabay|shutterstock|istock/i.test(s)), img.join(" "));
  assert.deepEqual(img, ["'self'", "data:", "blob:", "https://*.public.blob.vercel-storage.com"]);
});

test("LEG-9: next/image only optimises our own Blob gallery uploads", async () => {
  const { remotePatterns } = (await config()).images;
  assert.deepEqual(remotePatterns, [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/gallery/**" }]);
});

// SEC-25: pinned to our own store when BLOB_READ_WRITE_TOKEN is set at build time.
async function freshConfig(token: string | undefined) {
  const before = process.env.BLOB_READ_WRITE_TOKEN;
  if (token === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = token;
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (message: string) => void warnings.push(String(message));
  try {
    const configUrl = pathToFileURL(path.join(process.cwd(), "next.config.mjs")).href;
    const config = (await import(`${configUrl}?token=${encodeURIComponent(token ?? "none")}`)).default as {
      headers: () => Promise<HeaderRule[]>;
      images: { remotePatterns: { hostname: string; pathname?: string }[] };
    };
    const rules = await config.headers();
    const value = rules.flatMap((r) => r.headers).find((h) => h.key === "Content-Security-Policy")?.value ?? "";
    const img = value.split(";").map((p) => p.trim()).find((p) => p.startsWith("img-src"))?.split(/\s+/).slice(1) ?? [];
    return { img, remotePatterns: config.images.remotePatterns, warnings };
  } finally {
    console.warn = originalWarn;
    if (before === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = before;
  }
}

test("SEC-25: with the token, remotePatterns and img-src name only our store's host", async () => {
  const { img, remotePatterns, warnings } = await freshConfig("vercel_blob_rw_AbC123xyz_secretpart");
  assert.deepEqual(remotePatterns, [{ protocol: "https", hostname: "abc123xyz.public.blob.vercel-storage.com", pathname: "/gallery/**" }]);
  assert.deepEqual(img, ["'self'", "data:", "blob:", "https://abc123xyz.public.blob.vercel-storage.com"]);
  assert.equal(warnings.length, 0);
});

test("SEC-25: without a usable token, the wildcard stays and the build warns", async () => {
  for (const token of [undefined, "", "not-a-token", "vercel_blob_rw__secret", "vercel_blob_rw_bad*id_secret"]) {
    const { img, remotePatterns, warnings } = await freshConfig(token);
    assert.equal(remotePatterns[0].hostname, "*.public.blob.vercel-storage.com", String(token));
    assert.ok(img.includes("https://*.public.blob.vercel-storage.com"), String(token));
    assert.equal(warnings.length, 1, String(token));
    assert.match(warnings[0], /BLOB_READ_WRITE_TOKEN/);
  }
});

test("SEC-25: the store id matches @vercel/blob's own parsing (token.split('_')[3]) and the upload checks", async () => {
  const { blobStoreIdFromToken, ownBlobHost } = await import("./blob-host.mjs");
  const { canonicalBlobUrl } = await import("./upload");
  const token = "vercel_blob_rw_AbC123xyz_secretpart";
  assert.equal(blobStoreIdFromToken(token), token.split("_")[3].toLowerCase());
  assert.equal(ownBlobHost(token), "abc123xyz.public.blob.vercel-storage.com");
  const url = `https://${ownBlobHost(token)}/gallery/1799942400000-0123456789ab.jpg`;
  assert.equal(canonicalBlobUrl(url, token), url);
  for (const bad of [undefined, "", "vercel_blob_ro_abc_x", "vercel_blob_rw_a.b_x", "other_blob_rw_abc_x"]) {
    assert.equal(ownBlobHost(bad), null, String(bad));
  }
});
