import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPublicGalleryImage } from "./gallery-visibility";
import { NAV, PUBLIC_PAGES, navLinks, publicPages, sitemapEntries } from "./site";

// Batch 7 (design.md "Final whole-site review", change 1): while no public photo exists, the
// header, phone menu, footer and sitemap stop advertising /portfolio. The route stays live.

const token = "vercel_blob_rw_AbC123xyz_secretpart";
const own = "https://abc123xyz.public.blob.vercel-storage.com/gallery/1799942400000-0123456789ab.jpg";
const sample = "/images/portfolio/real-estate-photo-02.jpg";
const stock = "https://images.unsplash.com/photo-1.jpg";

test("hasPublicGalleryImage uses the portfolio page's rule", () => {
  assert.equal(hasPublicGalleryImage([], token), false);
  assert.equal(hasPublicGalleryImage([sample, stock], token), false, "repo samples and outside links don't count");
  assert.equal(hasPublicGalleryImage([sample, own], token), true);
  assert.equal(hasPublicGalleryImage(["/images/shoots/frame-house-01.jpg"], token), true, "a local file of his own counts");
});

test("no public photos: Portfolio is left out of the nav", () => {
  const hrefs = navLinks(false).map((item) => item.href);
  assert.deepEqual(hrefs, ["/services", "/about", "/contact"]);
});

test("with public photos: the nav is the full NAV, Portfolio second", () => {
  assert.deepEqual(navLinks(true), NAV);
  assert.equal(navLinks(true)[1].href, "/portfolio");
});

test("no public photos: the sitemap leaves out /portfolio and keeps every other page", () => {
  assert.deepEqual(publicPages(false), PUBLIC_PAGES.filter((page) => page !== "/portfolio"));
  const urls = sitemapEntries(false).map((entry) => entry.url);
  assert.ok(!urls.includes("https://fm-media.org/portfolio"));
  assert.ok(urls.includes("https://fm-media.org/privacy"));
  assert.equal(urls.length, PUBLIC_PAGES.length - 1);
});

test("with public photos: the sitemap lists /portfolio again", () => {
  const entries = sitemapEntries(true);
  assert.equal(entries.length, PUBLIC_PAGES.length);
  const portfolio = entries.find((entry) => entry.url === "https://fm-media.org/portfolio");
  assert.ok(portfolio);
  assert.equal(portfolio.priority, 0.8);
  assert.equal(entries[0].url, "https://fm-media.org");
  assert.equal(entries[0].priority, 1);
});
