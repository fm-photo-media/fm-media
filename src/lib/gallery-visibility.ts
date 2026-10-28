// LEG-9 / batch 4 (4.21-4.23) / SEC-25: which gallery rows may be shown, and where.
// Pure functions, shared by the public data loaders and the admin gallery pages.

import { isLocalImagePath, isOwnBlobUrl } from "./upload";

const REPO_SAMPLE_PREFIX = "/images/portfolio/";

// The sample photos that came with the repo and are still in public/images/portfolio/
// (a test keeps this list equal to the folder). None is confirmed as Francisco's own
// work, so they never appear on public pages, whatever their "published" flag says.
// QA-25: the old hero exterior with a legible house number was deleted, file and seed row.
export const REPO_SAMPLE_IMAGES: ReadonlySet<string> = new Set(
  [
    "real-estate-photo-02.jpg",
    "real-estate-photo-03.jpg",
    "real-estate-photo-04.jpg",
    "real-estate-photo-05.jpg",
    "real-estate-photo-07.jpg",
    "real-estate-photo-08.jpg",
    "real-estate-photo-10.jpg",
    "real-estate-photo-11.jpg",
    "real-estate-photo-12.jpg",
    "real-estate-photo-13.jpg",
    "rear-exterior-dsc08721.jpg"
  ].map((name) => REPO_SAMPLE_PREFIX + name)
);

// Used only when no Blob token is configured (local dev): next.config.mjs then falls back
// to the wildcard host, limited to /gallery/.
const ANY_BLOB_GALLERY_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/gallery\/[^?#\s]+$/;

export function isRepoSampleImage(url: string) {
  return url.startsWith(REPO_SAMPLE_PREFIX);
}

/** A repo sample row whose file is gone (deleted from the repo): nothing to show. */
function isRemovedSample(url: string) {
  return isRepoSampleImage(url) && !REPO_SAMPLE_IMAGES.has(url);
}

/**
 * True if next/image can load it under our config: a local file that exists, or our own
 * store's gallery upload (any store's /gallery/ file only when no token is set).
 */
export function canRenderGalleryImage(url: string, token: string | undefined) {
  if (isLocalImagePath(url)) return !isRemovedSample(url);
  return token ? isOwnBlobUrl(url, token) : ANY_BLOB_GALLERY_URL.test(url);
}

/**
 * Public pages: only our own store's uploads (the same rule as the gallery validator)
 * and other local files. Never repo samples, removed files or outside links.
 */
export function isPublicGalleryImage(url: string, token: string | undefined) {
  if (isLocalImagePath(url)) return !isRepoSampleImage(url);
  return isOwnBlobUrl(url, token);
}

/** Batch 7: whether /portfolio has anything to show (published rows' URLs in, same rule). */
export function hasPublicGalleryImage(urls: readonly string[], token: string | undefined) {
  return urls.some((url) => isPublicGalleryImage(url, token));
}

/** For /admin: why a row is kept off the public site even if it's marked Published. */
export function galleryImageNotice(url: string, token: string | undefined) {
  if (isRemovedSample(url)) {
    return "Hidden on the site: this sample photo was removed from the website. Delete this row.";
  }
  if (!isLocalImagePath(url) && !canRenderGalleryImage(url, token)) {
    return "Hidden on the site: this is an outside link (for example a stock photo), not one of your uploads. Upload your own photo instead, or delete this row.";
  }
  if (isRepoSampleImage(url)) {
    return "Hidden on the site: this is a sample photo that came with the website, not confirmed as your own work. Replace it with your own photo, or delete this row.";
  }
  return null;
}
