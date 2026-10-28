// Safety rules for prisma/seed.ts (SEC-5).
// The seed is for empty local databases only. It never deletes or updates rows,
// and it refuses to run in production or against a non-local host unless
// ALLOW_PROD_SEED=1 is set explicitly.

type Env = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // SEC-15: libpq/Prisma let ?host= or ?hostaddr= override the host in the URL.
    const overridesHost = Array.from(parsed.searchParams.keys()).some((name) => ["host", "hostaddr"].includes(name.toLowerCase()));
    if (overridesHost) return false;
    const host = parsed.hostname.toLowerCase();
    return LOCAL_HOSTS.has(host) || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  } catch {
    return false;
  }
}

export function assertSeedAllowed(env: Env): void {
  if (env.ALLOW_PROD_SEED === "1") return;
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV=production. Set ALLOW_PROD_SEED=1 only if you really mean it.");
  }
  if (!isLocalDatabaseUrl(env.DATABASE_URL)) {
    throw new Error(
      "Refusing to seed: DATABASE_URL is not a local database (localhost/127.0.0.1/::1). " +
        "Set ALLOW_PROD_SEED=1 only if you really mean it."
    );
  }
}

export type SeedDb<S extends { slug: string }, I extends { imageUrl: string; published?: boolean }> = {
  service: {
    findUnique(args: { where: { slug: string } }): Promise<unknown | null>;
    create(args: { data: S }): Promise<unknown>;
  };
  galleryImage: {
    findFirst(args: { where: { imageUrl: string } }): Promise<unknown | null>;
    create(args: { data: I }): Promise<unknown>;
  };
};

export async function seedInsertOnly<S extends { slug: string }, I extends { imageUrl: string; published?: boolean }>(
  db: SeedDb<S, I>,
  services: S[],
  images: I[]
) {
  const result = { servicesCreated: 0, servicesSkipped: 0, imagesCreated: 0, imagesSkipped: 0 };

  for (const service of services) {
    if (await db.service.findUnique({ where: { slug: service.slug } })) {
      result.servicesSkipped++;
      continue;
    }
    await db.service.create({ data: service });
    result.servicesCreated++;
  }

  for (const image of images) {
    if (await db.galleryImage.findFirst({ where: { imageUrl: image.imageUrl } })) {
      result.imagesSkipped++;
      continue;
    }
    // SEC-15: seeded images start hidden, so a re-seed can't re-publish photos the owner removed.
    await db.galleryImage.create({ data: { ...image, published: image.published ?? false } });
    result.imagesCreated++;
  }

  return result;
}
