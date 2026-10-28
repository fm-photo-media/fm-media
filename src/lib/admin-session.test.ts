import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_TTL_MS,
  adminSecretsFrom,
  createSession,
  hashSessionToken,
  revokeAllSessions,
  revokeSession,
  validateSession,
  type SessionStore
} from "./admin-session";

function memoryStore() {
  const rows = new Map<string, Date>();
  const store: SessionStore = {
    create: async ({ id, expiresAt }) => {
      rows.set(id, expiresAt);
    },
    find: async (id) => (rows.has(id) ? { expiresAt: rows.get(id)! } : null),
    delete: async (id) => {
      rows.delete(id);
    },
    deleteExpired: async (now) => {
      rows.forEach((expiresAt, id) => {
        if (expiresAt <= now) rows.delete(id);
      });
    },
    deleteAll: async () => {
      rows.clear();
    }
  };
  return { store, rows };
}

const SECRET = "test-session-secret-0123456789abcdef-xyz";
const t0 = new Date("2027-01-14T16:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

test("each login gets a new random token, and only its hash is stored", async () => {
  const { store, rows } = memoryStore();
  const a = await createSession(store, SECRET, t0);
  const b = await createSession(store, SECRET, t0);
  assert.notEqual(a.token, b.token);
  assert.ok(a.token.length >= 43, "32 random bytes, base64url");
  assert.equal(rows.size, 2);
  assert.ok(!rows.has(a.token), "the raw token is never stored");
  assert.ok(rows.has(hashSessionToken(a.token, SECRET)));
  assert.equal(a.expiresAt.getTime(), t0.getTime() + SESSION_TTL_MS);
});

test("a session is valid until it expires (12 hours), then it is rejected and removed", async () => {
  const { store, rows } = memoryStore();
  const { token } = await createSession(store, SECRET, t0);
  assert.equal(SESSION_TTL_MS, 12 * 60 * 60 * 1000);
  assert.equal(await validateSession(store, SECRET, token, at(SESSION_TTL_MS - 1)), true);
  assert.equal(await validateSession(store, SECRET, token, at(SESSION_TTL_MS)), false);
  assert.equal(rows.size, 0, "the expired row is deleted on sight");
  // Expiry is absolute: using the session doesn't extend it.
  const second = await createSession(store, SECRET, t0);
  for (let h = 1; h < 12; h++) await validateSession(store, SECRET, second.token, at(h * 60 * 60 * 1000));
  assert.equal(await validateSession(store, SECRET, second.token, at(SESSION_TTL_MS + 1)), false);
});

test("logout revokes the session server-side, so the old cookie stops working", async () => {
  const { store } = memoryStore();
  const { token } = await createSession(store, SECRET, t0);
  const other = await createSession(store, SECRET, t0);
  await revokeSession(store, SECRET, token);
  assert.equal(await validateSession(store, SECRET, token, at(1000)), false);
  assert.equal(await validateSession(store, SECRET, other.token, at(1000)), true, "other devices stay signed in");
  await revokeAllSessions(store);
  assert.equal(await validateSession(store, SECRET, other.token, at(1000)), false);
});

test("unknown, empty, oversized or foreign-secret tokens are rejected", async () => {
  const { store } = memoryStore();
  const { token } = await createSession(store, SECRET, t0);
  assert.equal(await validateSession(store, SECRET, undefined, t0), false);
  assert.equal(await validateSession(store, SECRET, "", t0), false);
  assert.equal(await validateSession(store, SECRET, "x".repeat(500), t0), false);
  assert.equal(await validateSession(store, SECRET, `${token}x`, t0), false);
  // Rotating ADMIN_SESSION_SECRET signs everyone out.
  assert.equal(await validateSession(store, `${SECRET}-rotated`, token, t0), false);
});

test("login clears out expired sessions", async () => {
  const { store, rows } = memoryStore();
  await createSession(store, SECRET, t0);
  await createSession(store, SECRET, at(SESSION_TTL_MS + 5));
  assert.equal(rows.size, 1);
});

test("production refuses missing, placeholder and weak admin secrets (SEC-6)", () => {
  const good = { NODE_ENV: "production", ADMIN_PASSWORD: "a-long-admin-password-1", ADMIN_SESSION_SECRET: SECRET };
  assert.deepEqual(adminSecretsFrom(good), { password: good.ADMIN_PASSWORD, secret: SECRET });

  const bad: Record<string, string | undefined>[] = [
    { ADMIN_PASSWORD: undefined },
    { ADMIN_PASSWORD: "change-me" },
    { ADMIN_PASSWORD: "password1" },
    { ADMIN_PASSWORD: "short-pass-15ch" },
    { ADMIN_SESSION_SECRET: undefined },
    { ADMIN_SESSION_SECRET: "replace-with-a-long-random-secret" },
    { ADMIN_SESSION_SECRET: "replace-with-32-plus-random-characters" },
    { ADMIN_SESSION_SECRET: "local-development-secret" },
    { ADMIN_SESSION_SECRET: "too-short-secret" },
    { ADMIN_SESSION_SECRET: "a-long-admin-password-1-but-also-the-secret", ADMIN_PASSWORD: "a-long-admin-password-1-but-also-the-secret" }
  ];
  for (const override of bad) {
    assert.throws(() => adminSecretsFrom({ ...good, ...override }), /ADMIN_/, JSON.stringify(override));
  }
});

test("outside production, local defaults are allowed", () => {
  const { password, secret } = adminSecretsFrom({ NODE_ENV: "development" });
  assert.equal(password, "change-me");
  assert.ok(secret.length >= 32);
});
