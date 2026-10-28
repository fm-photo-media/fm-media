// Gallery upload rules, shared by the server action, the client-upload token route and
// the admin form (so: no Node-only imports). Pure functions, tested in upload.test.ts.

import { blobStoreIdFromToken } from "./blob-host.mjs";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const MAX_GALLERY_UPLOAD_BYTES = 10 * 1024 * 1024;
// QA-6 / SEC-4: the server-action body limit is 1 MB (next.config.mjs). Anything bigger
// than this goes browser -> Blob through /api/gallery-upload, on create and on replace.
export const SERVER_UPLOAD_BYTES = 900 * 1024;

const EXTENSIONS: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif"
};

// What a client-upload pathname must look like (see galleryUploadPathname).
export const CLIENT_UPLOAD_PATHNAME = /^gallery\/\d{10,16}-[0-9a-f]{12}\.(jpg|png|webp|avif)$/;

export function shouldUploadFromBrowser(size: number) {
  return size > SERVER_UPLOAD_BYTES;
}

export function isAllowedImageType(type: string): type is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

const startsWith = (bytes: Uint8Array, offset: number, expected: number[]) =>
  expected.every((value, index) => bytes[offset + index] === value);
const ascii = (s: string) => s.split("").map((c) => c.charCodeAt(0));

/** SEC-11: the real image type from the file's first bytes, or null if it isn't one we allow. */
export function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, 0, ascii("RIFF")) && startsWith(bytes, 8, ascii("WEBP"))) return "image/webp";
  if (startsWith(bytes, 4, ascii("ftypavif")) || startsWith(bytes, 4, ascii("ftypavis"))) return "image/avif";
  return null;
}

// ---------------------------------------------------------------------------
// Batch 5b (design.md note 7): the pixel size is read from the file, not typed in.
// ---------------------------------------------------------------------------

export type ImageSize = { width: number; height: number };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);

/** EXIF orientation (1-8) from an APP1 segment's payload, or 1. */
function exifOrientation(b: Uint8Array, start: number, end: number) {
  if (!startsWith(b, start, ascii("Exif")) || b[start + 4] !== 0 || b[start + 5] !== 0) return 1;
  const tiff = start + 6;
  if (tiff + 8 > end) return 1;
  const little = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
  if (!little && !(b[tiff] === 0x4d && b[tiff + 1] === 0x4d)) return 1;
  const r16 = (i: number) => (little ? u16le(b, i) : u16be(b, i));
  const r32 = (i: number) => (little ? (u16le(b, i) | (u16le(b, i + 2) << 16)) >>> 0 : u32be(b, i));
  const ifd = tiff + r32(tiff + 4);
  if (ifd + 2 > end) return 1;
  const entries = r16(ifd);
  for (let n = 0; n < entries; n++) {
    const entry = ifd + 2 + n * 12;
    if (entry + 12 > end) return 1;
    if (r16(entry) === 0x0112) {
      const value = r16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

function jpegSize(b: Uint8Array): ImageSize | null {
  let i = 2;
  let orientation = 1;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    const body = i + 4;
    if (marker === 0xe1) orientation = exifOrientation(b, body, Math.min(b.length, i + 2 + length));
    // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (body + 5 > b.length) return null;
      const height = u16be(b, body + 1);
      const width = u16be(b, body + 3);
      if (!width || !height) return null;
      // Orientations 5-8 turn the picture by 90 degrees, so it shows upright as height x width.
      return orientation >= 5 ? { width: height, height: width } : { width, height };
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    i += 2 + length;
  }
  return null;
}

function webpSize(b: Uint8Array): ImageSize | null {
  if (b.length < 30) return null;
  if (startsWith(b, 12, ascii("VP8 "))) {
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (startsWith(b, 12, ascii("VP8L"))) {
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (startsWith(b, 12, ascii("VP8X"))) {
    return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  return null;
}

function avifSize(b: Uint8Array): ImageSize | null {
  const ispe = ascii("ispe");
  const limit = Math.min(b.length - 15, 64 * 1024);
  for (let i = 4; i < limit; i++) {
    if (startsWith(b, i, ispe)) {
      const width = u32be(b, i + 8);
      const height = u32be(b, i + 12);
      return width && height ? { width, height } : null;
    }
  }
  return null;
}

/** The upright pixel size of an allowed image from its bytes, or null if it can't be read. */
export function imageDimensions(bytes: Uint8Array): ImageSize | null {
  const type = detectImageType(bytes);
  const size =
    type === "image/jpeg"
      ? jpegSize(bytes)
      : type === "image/png"
        ? bytes.length >= 24 && startsWith(bytes, 12, ascii("IHDR"))
          ? { width: u32be(bytes, 16), height: u32be(bytes, 20) }
          : null
        : type === "image/webp"
          ? webpSize(bytes)
          : type === "image/avif"
            ? avifSize(bytes)
            : null;
  return size && size.width > 0 && size.height > 0 ? size : null;
}

function randomHex(bytes: number) {
  const values = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (v) => v.toString(16).padStart(2, "0")).join("");
}

/** SEC-11: a generated name (time + random), with the extension of the detected type. */
export function galleryUploadPathname(type: AllowedImageType, now = new Date()) {
  return `gallery/${now.getTime()}-${randomHex(6)}.${EXTENSIONS[type]}`;
}

// The Blob store id from a read-write token ("vercel_blob_rw_<storeId>_<secret>"). Shared
// with next.config.mjs (SEC-25), so the image config and these checks agree on one host.
export { blobStoreIdFromToken };

// Files uploaded before batch 3: put(`gallery/${Date.now()}-${lower-cased file name}`)
// with addRandomSuffix, e.g. gallery/1717800000000-front-porch-AbCdEf1234567890.jpg.
const LEGACY_UPLOAD_PATHNAME = /^gallery\/\d{10,16}-[a-z0-9][a-z0-9.-]{0,150}-[A-Za-z0-9]{1,64}\.[a-z0-9]{2,5}$/;
// An earlier client-upload build put the file name before the time, and the live site still
// serves one such file: gallery/dsc08766-test-1781334120039-DKXN7AW4k8Y11QveO4RcqaikX4h1gW.jpg
const LEGACY_NAME_FIRST_PATHNAME =
  /^gallery\/[a-z0-9][a-z0-9.-]{0,150}-\d{10,16}-[A-Za-z0-9]{1,64}\.(jpg|jpeg|png|webp|avif|gif)$/;

function isUploadPathname(pathname: string) {
  if (pathname.includes("..")) return false;
  return (
    CLIENT_UPLOAD_PATHNAME.test(pathname) ||
    LEGACY_UPLOAD_PATHNAME.test(pathname) ||
    LEGACY_NAME_FIRST_PATHNAME.test(pathname)
  );
}

/**
 * SEC-24: the one canonical spelling of a file in THIS project's public Blob store:
 * `https://<storeId>.public.blob.vercel-storage.com/gallery/<upload name>`, with no query,
 * fragment, credentials, port, upper-case host or percent-encoding. Returns that string,
 * or null if `url` isn't exactly it (anything that doesn't round-trip is refused), so a
 * variant spelling of an in-use file can never pass the "unused" row count before del().
 */
export function canonicalBlobUrl(url: string, token: string | undefined) {
  const storeId = blobStoreIdFromToken(token);
  if (!storeId || typeof url !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = `${storeId}.public.blob.vercel-storage.com`;
  if (parsed.protocol !== "https:" || parsed.hostname !== host) return null;
  if (parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) return null;
  const pathname = parsed.pathname.slice(1);
  if (!isUploadPathname(pathname)) return null;
  const canonical = `https://${host}/${pathname}`;
  return canonical === url ? canonical : null;
}

/**
 * SEC-8 / SEC-24: true only for the canonical URL of a gallery upload in THIS project's
 * public Blob store. Seed images (/images/...), outside links and other stores are never
 * deleted.
 */
export function isOwnBlobUrl(url: string, token: string | undefined) {
  return canonicalBlobUrl(url, token) !== null;
}

// Local files in public/images/: plain lower-case path segments and an image extension.
const LOCAL_IMAGE_PATH = /^\/images\/(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9_.-]*\.(?:jpe?g|png|webp|avif)$/;

export function isLocalImagePath(url: string) {
  return typeof url === "string" && LOCAL_IMAGE_PATH.test(url) && !url.includes("..");
}

/**
 * LEG-9: a gallery image is either our own Blob upload or a local /images file. Stock
 * photo sites (Unsplash and the like) and any other outside link are refused, so stock
 * photos can't appear as portfolio work.
 */
export function isAllowedGalleryImageUrl(url: string, token: string | undefined) {
  return isLocalImagePath(url) || isOwnBlobUrl(url, token);
}

// ---------------------------------------------------------------------------
// QA-21: browser -> Blob uploads must never spin forever.
// ---------------------------------------------------------------------------

/** The browser gives up on a Blob upload after this long and shows an error. */
export const CLIENT_UPLOAD_TIMEOUT_MS = 90 * 1000;

/** The message the admin form shows (role="alert") when a browser upload fails. */
export function clientUploadErrorMessage(error: unknown, timedOut: boolean) {
  if (timedOut) {
    return "The upload took too long and was stopped. Check your connection and try again. Your other entries are kept.";
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("private store")) {
    return "Vercel Blob is set to private. Create or connect a public Blob store before uploading gallery images.";
  }
  return "The image could not be uploaded. Check your connection and the Vercel Blob settings, then try again.";
}

// ---------------------------------------------------------------------------
// SEC-11: re-check a browser upload's real bytes on the server.
// ---------------------------------------------------------------------------

export type UploadCheck = "ok" | "invalid" | "unverified";
type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

// Replies that may succeed if tried again: timeouts, rate limits and server errors.
const TRANSIENT_STATUSES = new Set([408, 425, 429]);

/**
 * Fetches the first 64 bytes of a just-uploaded blob.
 * - "ok": real image bytes.
 * - "invalid": not an allowed image, OR the store definitely refused (404, 403 and other
 *   4xx). Fails CLOSED: the upload is rejected.
 * - "unverified": only a genuine transient failure (network error, timeout, 5xx, 408,
 *   425, 429). The caller may accept it, because the upload token already limits the type.
 */
export async function checkUploadedBlob(url: string, fetchImpl: FetchLike = fetch): Promise<UploadCheck> {
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { Range: "bytes=0-63" }, signal: AbortSignal.timeout(5000) });
  } catch {
    return "unverified";
  }

  if (!response.ok) {
    return response.status >= 500 || TRANSIENT_STATUSES.has(response.status) ? "unverified" : "invalid";
  }

  try {
    const bytes = new Uint8Array(await response.arrayBuffer()).slice(0, 64);
    return detectImageType(bytes) ? "ok" : "invalid";
  } catch {
    // The body stream broke mid-read: a network problem, not a verdict on the file.
    return "unverified";
  }
}

/** QA-24: shown (role="alert") when a browser upload worked but the form couldn't be sent. */
export const UNSENT_AFTER_UPLOAD_MESSAGE =
  "The image uploaded, but the form could not be sent, so nothing was saved. Check the highlighted fields and try again.";
