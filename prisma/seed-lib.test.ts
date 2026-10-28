import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSeedAllowed, isLocalDatabaseUrl, seedInsertOnly, type SeedDb } from "./seed-lib";

const LOCAL = "postgresql://postgres:postgres@127.0.0.1:5432/fm_media";
const REMOTE = "postgresql://user:pw@ep-cool-name.us-east-2.aws.neon.tech/fm_media?sslmode=require";

test("isLocalDatabaseUrl accepts only loopback hosts", () => {
  assert.equal(isLocalDatabaseUrl(LOCAL), true);
  assert.equal(isLocalDatabaseUrl("postgresql://u:p@localhost:5432/db"), true);
  assert.equal(isLocalDatabaseUrl("postgresql://u:p@[::1]:5432/db"), true);
  assert.equal(isLocalDatabaseUrl(REMOTE), false);
  assert.equal(isLocalDatabaseUrl("postgresql://u:p@localhost.evil.com/db"), false);
  assert.equal(isLocalDatabaseUrl("not a url"), false);
  assert.equal(isLocalDatabaseUrl(undefined), false);
});

test("seed refuses when NODE_ENV=production, even on a local DB", () => {
  assert.throws(() => assertSeedAllowed({ NODE_ENV: "production", DATABASE_URL: LOCAL }), /production/i);
});

test("seed refuses a non-local DATABASE_URL", () => {
  assert.throws(() => assertSeedAllowed({ NODE_ENV: "development", DATABASE_URL: REMOTE }), /local/i);
  assert.throws(() => assertSeedAllowed({ DATABASE_URL: undefined }), /local/i);
});

test("ALLOW_PROD_SEED=1 is the only override", () => {
  assert.throws(() => assertSeedAllowed({ NODE_ENV: "production", DATABASE_URL: REMOTE, ALLOW_PROD_SEED: "true" }));
  assert.doesNotThrow(() => assertSeedAllowed({ NODE_ENV: "production", DATABASE_URL: REMOTE, ALLOW_PROD_SEED: "1" }));
});

test("seed is allowed on a local DB outside production", () => {
  assert.doesNotThrow(() => assertSeedAllowed({ NODE_ENV: "development", DATABASE_URL: LOCAL }));
});

type Svc = { slug: string; title: string };
type Img = { imageUrl: string; title: string };

function fakeDb(services: Svc[], images: Img[]) {
  const calls: string[] = [];
  const db: SeedDb<Svc, Img> & Record<string, unknown> = {
    service: {
      findUnique: async ({ where }) => services.find((s) => s.slug === where.slug) ?? null,
      create: async ({ data }) => {
        calls.push(`service.create:${data.slug}`);
        services.push(data);
        return data;
      }
    },
    galleryImage: {
      findFirst: async ({ where }) => images.find((i) => i.imageUrl === where.imageUrl) ?? null,
      create: async ({ data }) => {
        calls.push(`galleryImage.create:${data.imageUrl}`);
        images.push(data);
        return data;
      }
    }
  };
  return { db, calls, services, images };
}

test("seed never deletes or overwrites existing rows, and only inserts missing ones", async () => {
  const adminEditedService = { slug: "basic", title: "Basic (edited by admin)" };
  const adminOnlyService = { slug: "admin-made", title: "Added in /admin" };
  const adminUpload = { imageUrl: "https://x.public.blob.vercel-storage.com/a.jpg", title: "Upload" };
  const existingSeedImage = { imageUrl: "/images/portfolio/real-estate-photo-01.jpg", title: "Renamed" };
  const { db, calls, services, images } = fakeDb(
    [adminEditedService, adminOnlyService],
    [adminUpload, existingSeedImage]
  );

  const result = await seedInsertOnly(
    db,
    [
      { slug: "basic", title: "Basic" },
      { slug: "floor-plans", title: "Floor Plans" }
    ],
    [
      { imageUrl: "/images/portfolio/real-estate-photo-01.jpg", title: "Front Exterior" },
      { imageUrl: "/images/portfolio/real-estate-photo-02.jpg", title: "Back Patio" }
    ]
  );

  assert.deepEqual(calls, [
    "service.create:floor-plans",
    "galleryImage.create:/images/portfolio/real-estate-photo-02.jpg"
  ]);
  assert.deepEqual(result, { servicesCreated: 1, servicesSkipped: 1, imagesCreated: 1, imagesSkipped: 1 });
  // Existing rows untouched, admin-only rows still present.
  assert.equal(services.find((s) => s.slug === "basic")?.title, "Basic (edited by admin)");
  assert.ok(services.includes(adminOnlyService));
  assert.ok(images.includes(adminUpload));
  assert.equal(images.find((i) => i.imageUrl === existingSeedImage.imageUrl)?.title, "Renamed");
});
