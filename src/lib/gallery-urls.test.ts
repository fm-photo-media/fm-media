import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { canonicalBlobUrl, isAllowedGalleryImageUrl, isOwnBlobUrl } from "./upload";
import { REPO_SAMPLE_IMAGES, canRenderGalleryImage, galleryImageNotice, isPublicGalleryImage } from "./gallery-visibility";
import { galleryImageSchema } from "./validation";

const token = "vercel_blob_rw_AbC123xyz_secretpart";
const host = "https://abc123xyz.public.blob.vercel-storage.com";
const current = `${host}/gallery/1799942400000-0123456789ab.jpg`;
// Uploaded before batch 3: gallery/<ms>-<lower-cased file name>-<Vercel random suffix>.<ext>
const legacy = `${host}/gallery/1717800000000-front-porch-AbCdEf1234567890.jpg`;

test("SEC-24: canonical Blob URLs round-trip; every variant spelling is refused", () => {
  assert.equal(canonicalBlobUrl(current, token), current);
  assert.equal(canonicalBlobUrl(legacy, token), legacy);

  // The four variants from security-report.md:
  assert.equal(canonicalBlobUrl(`${current}?x=1`, token), null, "query string");
  assert.equal(canonicalBlobUrl(`${current}#f`, token), null, "fragment");
  assert.equal(canonicalBlobUrl(current.replace("abc123xyz.public", "ABC123xyz.Public"), token), null, "upper-case host");
  assert.equal(canonicalBlobUrl(`${host}/gallery/1799942400000-0123456789ab%2Ejpg`, token), null, "%2E in the name");

  // More spellings that would still reach the same file:
  for (const variant of [
    `${current}?`,
    `${current}#`,
    current.replace("https://", "https://user:pw@"),
    current.replace(".com/", ".com:443/"),
    current.replace("/gallery/", "/gallery//"),
    current.replace("/gallery/", "/x/../gallery/"),
    current.replace("/gallery/", "/%67allery/"),
    `${current} `,
    `${host}/gallery/1717800000000-a..b.jpg`
  ]) {
    assert.equal(canonicalBlobUrl(variant, token), null, variant);
  }

  // Not our files at all:
  assert.equal(canonicalBlobUrl(current, undefined), null, "no token");
  assert.equal(canonicalBlobUrl(current.replace("abc123xyz", "someoneelse"), token), null, "other store");
  assert.equal(canonicalBlobUrl(current.replace("https:", "http:"), token), null, "http");
  assert.equal(canonicalBlobUrl(`${host}/other/1799942400000-0123456789ab.jpg`, token), null, "outside gallery/");
  assert.equal(canonicalBlobUrl(`${host}/gallery/evil.html`, token), null, "not an upload name");
});

test("the name-first legacy upload still on the live site counts as our own, public upload", () => {
  const nameFirst = `${host}/gallery/dsc08766-test-1781334120039-DKXN7AW4k8Y11QveO4RcqaikX4h1gW.jpg`;
  assert.equal(canonicalBlobUrl(nameFirst, token), nameFirst);
  assert.equal(isOwnBlobUrl(nameFirst, token), true);
  assert.equal(isAllowedGalleryImageUrl(nameFirst, token), true);
  assert.equal(isPublicGalleryImage(nameFirst, token), true);

  for (const bad of [
    `${host}/gallery/dsc08766-test-1781334120039-DKXN7AW4k8Y11QveO4RcqaikX4h1gW.html`,
    `${host}/gallery/dsc08766-test-DKXN7AW4k8Y11QveO4RcqaikX4h1gW.jpg`,
    `${host}/gallery/dsc..08766-1781334120039-DKXN7AW4k8Y11QveO4RcqaikX4h1gW.jpg`,
    `${host}/gallery/dsc08766-test-1781334120039-DKXN7AW4k8Y11QveO4RcqaikX4h1gW.jpg?x=1`,
    nameFirst.replace("abc123xyz", "someoneelse")
  ]) {
    assert.equal(canonicalBlobUrl(bad, token), null, bad);
  }
});

test("SEC-24: isOwnBlobUrl (used before the row count and del()) is the canonical check", () => {
  assert.equal(isOwnBlobUrl(current, token), true);
  assert.equal(isOwnBlobUrl(legacy, token), true);
  for (const variant of [`${current}?x=1`, `${current}#f`, current.toUpperCase(), `${host}/gallery/1799942400000-0123456789ab%2Ejpg`]) {
    assert.equal(isOwnBlobUrl(variant, token), false, variant);
  }
});

test("LEG-9: gallery images can only be our own Blob uploads or local /images files", () => {
  assert.equal(isAllowedGalleryImageUrl(current, token), true);
  assert.equal(isAllowedGalleryImageUrl(legacy, token), true);
  assert.equal(isAllowedGalleryImageUrl("/images/portfolio/real-estate-photo-02.jpg", token), true);
  assert.equal(isAllowedGalleryImageUrl("/images/portfolio/real-estate-photo-02.jpg", undefined), true);

  for (const bad of [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600",
    "https://plus.unsplash.com/premium_photo-1.jpg",
    "https://images.pexels.com/photos/1/pexels-photo-1.jpeg",
    "https://cdn.example.com/house.jpg",
    "https://someoneelse.public.blob.vercel-storage.com/gallery/1799942400000-0123456789ab.jpg",
    `${current}?x=1`,
    "/images/../secret.jpg",
    "/images//x.jpg",
    "//images.unsplash.com/photo.jpg",
    "/images/x.svg",
    "javascript:alert(1)",
    ""
  ]) {
    assert.equal(isAllowedGalleryImageUrl(bad, token), false, bad);
  }
  // Without a Blob token we can't tell our store from anyone else's, so no Blob URL passes.
  assert.equal(isAllowedGalleryImageUrl(current, undefined), false);
});

test("LEG-9: the gallery form validator refuses stock-photo links", () => {
  const before = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = token;
  try {
    const base = { title: "Front", alt: "Front exterior of a home", category: "Exterior" };
    assert.equal(galleryImageSchema.safeParse({ ...base, imageUrl: current }).success, true);
    assert.equal(galleryImageSchema.safeParse({ ...base, imageUrl: "/images/portfolio/real-estate-photo-02.jpg" }).success, true);
    const stock = galleryImageSchema.safeParse({ ...base, imageUrl: "https://images.unsplash.com/photo-1" });
    assert.equal(stock.success, false);
    assert.doesNotMatch(JSON.stringify(stock.error?.issues), /unsplash/i);
  } finally {
    if (before === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = before;
  }
});

test("4.21 / 4.23 / SEC-25: public pages show only our own store's uploads, never samples or outside links", () => {
  assert.equal(isPublicGalleryImage("/images/portfolio/real-estate-photo-04.jpg", token), false);
  assert.equal(isPublicGalleryImage("/images/portfolio/rear-exterior-dsc08721.jpg", token), false);
  assert.equal(isPublicGalleryImage("/images/portfolio/real-estate-photo-99.jpg", token), false, "a removed sample");
  assert.equal(isPublicGalleryImage("https://images.unsplash.com/photo-1", token), false);
  assert.equal(isPublicGalleryImage("https://evil.example/gallery/x.jpg", token), false);
  assert.equal(isPublicGalleryImage(current, token), true);
  assert.equal(isPublicGalleryImage(legacy, token), true);
  assert.equal(isPublicGalleryImage("/images/shoots/naperville-01.jpg", token), true);
  // SEC-25: the same rule as the validator. Another store, or a variant spelling, is refused.
  assert.equal(isPublicGalleryImage(current.replace("abc123xyz", "someoneelse"), token), false);
  assert.equal(isPublicGalleryImage(`${current}?x=1`, token), false);
  assert.equal(isPublicGalleryImage(current, undefined), false, "no token: no Blob image is public");
});

test("admin: only loadable images go through next/image, and each hidden row says why", () => {
  assert.equal(canRenderGalleryImage(current, token), true);
  assert.equal(canRenderGalleryImage("/images/portfolio/real-estate-photo-02.jpg", token), true);
  assert.equal(canRenderGalleryImage("/images/portfolio/real-estate-photo-99.jpg", token), false, "file removed");
  assert.equal(canRenderGalleryImage("https://images.unsplash.com/photo-1", token), false);
  assert.equal(canRenderGalleryImage(current.replace("abc123xyz", "someoneelse"), token), false, "SEC-25: other store");
  assert.equal(canRenderGalleryImage("https://abc.public.blob.vercel-storage.com/other/x.jpg", undefined), false);
  assert.equal(canRenderGalleryImage("https://abc.public.blob.vercel-storage.com/gallery/x.jpg", undefined), true, "no token: wildcard fallback");

  assert.match(galleryImageNotice("/images/portfolio/real-estate-photo-02.jpg", token) ?? "", /sample photo that came with the website/i);
  assert.match(galleryImageNotice("/images/portfolio/real-estate-photo-99.jpg", token) ?? "", /removed from the website/i);
  assert.match(galleryImageNotice("https://images.unsplash.com/photo-1", token) ?? "", /outside link/i);
  assert.match(galleryImageNotice(current.replace("abc123xyz", "someoneelse"), token) ?? "", /outside link/i);
  assert.equal(galleryImageNotice(current, token), null);
});

test("QA-25: the sample list matches public/images/portfolio, and every seed image file exists", () => {
  const folder = readdirSync(path.join(process.cwd(), "public/images/portfolio")).map((name) => `/images/portfolio/${name}`);
  assert.deepEqual(Array.from(REPO_SAMPLE_IMAGES).sort(), folder.sort());
  const seed = readFileSync(path.join(process.cwd(), "prisma/seed.ts"), "utf8");
  const seedUrls = Array.from(seed.matchAll(/imageUrl: "([^"]+)"/g), (match) => match[1]);
  assert.ok(seedUrls.length > 0);
  for (const url of seedUrls) assert.ok(REPO_SAMPLE_IMAGES.has(url), `seed image ${url} has a file`);
});
