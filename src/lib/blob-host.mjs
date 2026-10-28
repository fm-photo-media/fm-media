// SEC-25: our own public Blob store host, from BLOB_READ_WRITE_TOKEN.
// Plain JS so next.config.mjs can import it at build time; upload.ts uses it too.
// @vercel/blob 2.4.0 reads the store id as token.split("_")[3] ("vercel_blob_rw_<storeId>_<secret>")
// and builds file URLs as `https://${storeId}.${access}.blob.vercel-storage.com/${pathname}`.

export const BLOB_WILDCARD_HOST = "*.public.blob.vercel-storage.com";

/** The lower-cased store id, or null if the token is missing or malformed. */
export function blobStoreIdFromToken(token) {
  if (typeof token !== "string") return null;
  const [prefix, kind, mode, storeId] = token.trim().split("_");
  if (prefix !== "vercel" || kind !== "blob" || mode !== "rw") return null;
  return storeId && /^[A-Za-z0-9]{1,64}$/.test(storeId) ? storeId.toLowerCase() : null;
}

/** `<storeId>.public.blob.vercel-storage.com`, or null without a usable token. */
export function ownBlobHost(token) {
  const storeId = blobStoreIdFromToken(token);
  return storeId ? `${storeId}.public.blob.vercel-storage.com` : null;
}

/**
 * The host next/image and the CSP img-src allow. Pinned to our store when the token is
 * there at build time; otherwise the old wildcard, with a build warning.
 */
export function imageHostForBuild(token, warn = console.warn) {
  const host = ownBlobHost(token);
  if (host) return host;
  warn(
    "[next.config] BLOB_READ_WRITE_TOKEN is missing or malformed at build time, so images and the CSP " +
      `allow any ${BLOB_WILDCARD_HOST}/gallery/ file. Set the token for the build to pin them to our own store.`
  );
  return BLOB_WILDCARD_HOST;
}
