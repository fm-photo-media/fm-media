import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PriceMenu } from "../components/price-menu";
import { firstShootDroneOffer } from "./promotion";
import type { Menu } from "./price-menu";

// Batch 8 (design.md "Build spec: Variant B", Price sentence / Price list): PriceMenu takes a
// heading level (h2 on home, h1 on /services), sets the price sentence with the lowest
// package on a .tag block, and keeps the offer once, verbatim from promotion.ts.

const item = (slug: string, title: string, amount: number, note = "") => ({ slug, title, price: `$${amount}`, amount, plus: false, note });
const menu: Menu = {
  packages: [item("basic", "Basic", 100, "Up to 1,500 sq ft."), item("standard", "Standard", 135)],
  addOns: [item("drone-photos", "Drone Photos", 75)],
  video: [item("walk", "Basic Walkthrough", 150)]
};
const empty: Menu = { packages: [], addOns: [], video: [] };

const render = (props: Partial<Parameters<typeof PriceMenu>[0]>) =>
  renderToStaticMarkup(createElement(PriceMenu, { menu, heading: "h2", ...props }));

test("PriceMenu: heading h2 on home, with the price sentence and the lowest price on a tag", () => {
  const html = render({ heading: "h2" });
  assert.match(html, /<h2 class="display" id="prices-h">Listing photos<br\/>from <span class="tag">\$100<\/span><\/h2>/);
  assert.doesNotMatch(html, /<h1/);
});

test("PriceMenu: heading h1 on /services", () => {
  const html = render({ heading: "h1", headingId: "h1" });
  assert.match(html, /<h1 class="display" id="h1">Listing photos<br\/>from <span class="tag">\$100<\/span><\/h1>/);
  assert.doesNotMatch(html, /<h2 class="display"/);
});

test("PriceMenu: with no packages the heading reads 'Services and pricing'", () => {
  const html = render({ menu: empty, heading: "h1" });
  assert.match(html, /<h1 class="display" id="prices-h">Services and pricing<\/h1>/);
});

test("PriceMenu: one .plist-wrap holds the list and footnotes; packages are .pkg radios; add-ons share a column with the offer", () => {
  const html = render({ footnote: ["One.", "Two."] });
  assert.equal(html.split('class="plist-wrap"').length - 1, 1);
  const wrap = html.slice(html.indexOf('class="plist-wrap"'));
  assert.ok(wrap.includes('id="builder"') && wrap.includes('class="prices__foot"'), "form and footnotes inside the wrapper");
  assert.equal(html.split('class="pkg"').length - 1, 2);
  // Add-ons + offer in one column div, then Video in its own column.
  const extras = html.slice(html.indexOf('class="extras"'));
  const addAt = extras.indexOf('id="prices-add"');
  const offerAt = extras.indexOf('class="offer"');
  const videoAt = extras.indexOf('id="prices-video"');
  assert.ok(addAt > 0 && offerAt > addAt && videoAt > offerAt);
  assert.match(extras, /^class="extras"><div><div class="group"/);
});

test("PriceMenu: the offer appears once, verbatim from promotion.ts", () => {
  const html = render({});
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
  assert.equal(html.split(esc(firstShootDroneOffer.body)).length - 1, 1);
  assert.equal(html.split(esc(firstShootDroneOffer.terms)).length - 1, 1);
});

test("PriceMenu: the under-row content renders between the heading and the list", () => {
  const html = render({ under: createElement("p", null, "Under line") });
  const at = html.indexOf('<div class="prices__under"><p>Under line</p></div>');
  assert.ok(at > 0 && at < html.indexOf('id="builder"'));
});

// QA-38: no skipped heading level. Under the /services h1 the groups are h2; under home's h2 they are h3.
test("PriceMenu: group headings are h2 under an h1 and h3 under an h2", () => {
  const services = render({ heading: "h1", headingId: "h1" });
  assert.match(services, /<h2 class="h3 group__h" id="prices-pkg">Photo packages<\/h2>/);
  assert.match(services, /<h2 class="h3 group__h" id="prices-add">Add-ons<\/h2>/);
  assert.match(services, /<h2 class="h3 group__h" id="prices-video">Video<\/h2>/);
  assert.doesNotMatch(services, /<h3/);
  const home = render({ heading: "h2" });
  assert.match(home, /<h3 class="h3 group__h" id="prices-pkg">Photo packages<\/h3>/);
  assert.doesNotMatch(home, /<h2 class="h3 group__h"/);
});

// LEG-14: the free-drone offer shows only when it can be honoured (drone photos and a package offered).
test("PriceMenu: no offer without a drone-photos add-on or without a package", () => {
  const noDrone = render({ menu: { ...menu, addOns: [item("floor-plans", "Floor Plans", 50)] } });
  assert.doesNotMatch(noDrone, /class="offer"/);
  assert.doesNotMatch(noDrone, /name="first"/);
  const noPackages = render({ menu: { ...menu, packages: [] } });
  assert.doesNotMatch(noPackages, /class="offer"/);
  assert.match(render({}), /class="offer"/);
});
