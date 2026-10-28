import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_UPLOAD_PATHNAME,
  CLIENT_UPLOAD_TIMEOUT_MS,
  UNSENT_AFTER_UPLOAD_MESSAGE,
  checkUploadedBlob,
  clientUploadErrorMessage,
  SERVER_UPLOAD_BYTES,
  blobStoreIdFromToken,
  detectImageType,
  galleryUploadPathname,
  isOwnBlobUrl,
  shouldUploadFromBrowser
} from "./upload";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);
const ascii = (s: string) => s.split("").map((c) => c.charCodeAt(0));

test("SEC-11: the image type comes from the file's bytes, not its name or declared type", () => {
  assert.equal(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "image/png");
  assert.equal(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"))), "image/webp");
  assert.equal(detectImageType(bytes(0, 0, 0, 0x1c, ...ascii("ftypavif"))), "image/avif");
  assert.equal(detectImageType(bytes(0, 0, 0, 0x1c, ...ascii("ftypavis"))), "image/avif");
  // Not images (or not allowed ones):
  assert.equal(detectImageType(bytes(...ascii("<html><script>"))), null);
  assert.equal(detectImageType(bytes(...ascii("<svg xmlns="))), null);
  assert.equal(detectImageType(bytes(...ascii("GIF89a"))), null);
  assert.equal(detectImageType(bytes(0, 0, 0, 0x1c, ...ascii("ftypheic"))), null);
  assert.equal(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE"))), null);
  assert.equal(detectImageType(new Uint8Array([0xff, 0xd8])), null);
});

test("SEC-11: upload names are generated, never taken from the user's filename", () => {
  const name = galleryUploadPathname("image/jpeg", new Date("2027-01-14T16:00:00Z"));
  assert.match(name, /^gallery\/1799942400000-[0-9a-f]{12}\.jpg$/);
  assert.match(galleryUploadPathname("image/png"), /\.png$/);
  assert.match(galleryUploadPathname("image/webp"), /\.webp$/);
  assert.match(galleryUploadPathname("image/avif"), /\.avif$/);
  assert.notEqual(galleryUploadPathname("image/png"), galleryUploadPathname("image/png"));
  assert.match(galleryUploadPathname("image/png"), CLIENT_UPLOAD_PATHNAME);
  for (const bad of ["gallery/evil.html", "gallery/../x.jpg", "gallery/1-abc.svg", "other/1-abcdef123456.jpg", "gallery/1-ABC.jpg"]) {
    assert.doesNotMatch(bad, CLIENT_UPLOAD_PATHNAME, bad);
  }
});

test("SEC-8: only this project's own gallery blobs are ever deleted", () => {
  const token = "vercel_blob_rw_AbC123xyz_secretpart";
  assert.equal(blobStoreIdFromToken(token), "abc123xyz");
  assert.equal(isOwnBlobUrl("https://abc123xyz.public.blob.vercel-storage.com/gallery/1799942400000-0123456789ab.jpg", token), true);
  assert.equal(isOwnBlobUrl("https://someoneelse.public.blob.vercel-storage.com/gallery/1799942400000-0123456789ab.jpg", token), false);
  assert.equal(isOwnBlobUrl("https://abc123xyz.public.blob.vercel-storage.com/other/1799942400000-0123456789ab.jpg", token), false);
  assert.equal(isOwnBlobUrl("http://abc123xyz.public.blob.vercel-storage.com/gallery/1799942400000-0123456789ab.jpg", token), false);
  assert.equal(isOwnBlobUrl("/images/portfolio/real-estate-photo-02.jpg", token), false);
  assert.equal(isOwnBlobUrl("https://images.unsplash.com/photo-1", token), false);
  assert.equal(isOwnBlobUrl("not a url", token), false);
  assert.equal(isOwnBlobUrl("https://abc123xyz.public.blob.vercel-storage.com/gallery/1799942400000-0123456789ab.jpg", undefined), false);
});

test("QA-6: files over the server-action size go browser -> Blob, on create and on replace", () => {
  assert.ok(SERVER_UPLOAD_BYTES <= 1024 * 1024 - 64 * 1024, "leaves room under the 1 MB action body limit");
  assert.equal(shouldUploadFromBrowser(SERVER_UPLOAD_BYTES), false);
  assert.equal(shouldUploadFromBrowser(SERVER_UPLOAD_BYTES + 1), true);
  assert.equal(shouldUploadFromBrowser(6 * 1024 * 1024), true);
});

const jpegHead = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(60).fill(0)]);
const htmlHead = new Uint8Array(ascii("<!doctype html><html><body>hi</body></html>____________________"));
const reply = (status: number, body: Uint8Array = jpegHead) => async () => new Response(new Blob([body as BlobPart]), { status });

test("SEC-11: a browser upload passes the re-check only with real image bytes", async () => {
  assert.equal(await checkUploadedBlob("https://x/gallery/1.jpg", reply(206)), "ok");
  assert.equal(await checkUploadedBlob("https://x/gallery/1.jpg", reply(200)), "ok");
  assert.equal(await checkUploadedBlob("https://x/gallery/1.jpg", reply(206, htmlHead)), "invalid");
});

test("verifyBrowserUpload fails CLOSED on 404 and 403 (and other definite 4xx replies)", async () => {
  for (const status of [400, 401, 403, 404, 410]) {
    assert.equal(await checkUploadedBlob("https://x/gallery/1.jpg", reply(status)), "invalid", String(status));
  }
});

test("only genuine transient failures are soft (network error, timeout, 5xx, 408, 429)", async () => {
  const networkError = async (): Promise<Response> => {
    throw new TypeError("fetch failed");
  };
  const timeout = async (): Promise<Response> => {
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  };
  assert.equal(await checkUploadedBlob("https://x/gallery/1.jpg", networkError), "unverified");
  assert.equal(await checkUploadedBlob("https://x/gallery/1.jpg", timeout), "unverified");
  for (const status of [408, 429, 500, 502, 503]) {
    assert.equal(await checkUploadedBlob("https://x/gallery/1.jpg", reply(status)), "unverified", String(status));
  }
});

test("the re-check asks only for the first 64 bytes, with a timeout", async () => {
  let seen: RequestInit | undefined;
  await checkUploadedBlob("https://x/gallery/1.jpg", async (_url, init) => {
    seen = init;
    return new Response(new Blob([jpegHead]), { status: 206 });
  });
  assert.equal(new Headers(seen?.headers).get("Range"), "bytes=0-63");
  assert.ok(seen?.signal instanceof AbortSignal);
});

test("QA-21: the browser upload has a timeout and a clear message for each failure", () => {
  assert.ok(CLIENT_UPLOAD_TIMEOUT_MS >= 60_000 && CLIENT_UPLOAD_TIMEOUT_MS <= 120_000);
  assert.match(clientUploadErrorMessage(new Error("x"), true), /took too long/);
  assert.match(clientUploadErrorMessage(new Error("Cannot use public access on a private store"), false), /private/);
  assert.match(clientUploadErrorMessage(new Error("Failed to fetch"), false), /could not be uploaded/);
  assert.match(clientUploadErrorMessage("weird", false), /could not be uploaded/);
});

test("QA-24: when the form can't be sent after an upload, the message says what to do", () => {
  assert.match(UNSENT_AFTER_UPLOAD_MESSAGE, /nothing was saved/);
  assert.match(UNSENT_AFTER_UPLOAD_MESSAGE, /try again/);
});
