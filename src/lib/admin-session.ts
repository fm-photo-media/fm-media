import crypto from "crypto";
import { isPlaceholderSecret } from "@/lib/secrets";

// SEC-2: one random session per login, stored server-side with an absolute expiry.
// Only an HMAC of the token is stored, so a DB read can't be replayed as a cookie,
// and rotating ADMIN_SESSION_SECRET signs every device out. No next/* imports, so
// this file is unit-tested directly (admin-session.test.ts).

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 128;

export type SessionStore = {
  create(row: { id: string; expiresAt: Date }): Promise<void>;
  find(id: string): Promise<{ expiresAt: Date } | null>;
  delete(id: string): Promise<void>;
  deleteExpired(now: Date): Promise<void>;
  deleteAll(): Promise<void>;
};

export function hashSessionToken(token: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(`admin-session:${token}`).digest("hex");
}

export async function createSession(store: SessionStore, secret: string, now = new Date()) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await store.deleteExpired(now);
  await store.create({ id: hashSessionToken(token, secret), expiresAt });
  return { token, expiresAt };
}

/** Valid only if the row exists and hasn't expired. Expired rows are removed. */
export async function validateSession(store: SessionStore, secret: string, token: string | undefined, now = new Date()) {
  if (!token || token.length > MAX_TOKEN_LENGTH) return false;
  const id = hashSessionToken(token, secret);
  const row = await store.find(id);
  if (!row) return false;
  if (row.expiresAt.getTime() <= now.getTime()) {
    await store.delete(id);
    return false;
  }
  return true;
}

export async function revokeSession(store: SessionStore, secret: string, token: string | undefined) {
  if (!token || token.length > MAX_TOKEN_LENGTH) return;
  await store.delete(hashSessionToken(token, secret));
}

export async function revokeAllSessions(store: SessionStore) {
  await store.deleteAll();
}

type Env = Record<string, string | undefined>;

export const MIN_ADMIN_PASSWORD_LENGTH = 16;
export const MIN_SECRET_LENGTH = 32;
const DEV_SESSION_SECRET = "local-development-session-secret-not-for-production";

/** SEC-6: in production, refuse missing, placeholder or weak admin secrets. */
export function adminSecretsFrom(env: Env) {
  const password = env.ADMIN_PASSWORD;
  const secret = env.ADMIN_SESSION_SECRET;

  if (env.NODE_ENV !== "production") {
    return { password: password || "change-me", secret: secret || DEV_SESSION_SECRET };
  }

  if (!password || password.length < MIN_ADMIN_PASSWORD_LENGTH || isPlaceholderSecret(password)) {
    throw new Error(`ADMIN_PASSWORD must be set to ${MIN_ADMIN_PASSWORD_LENGTH}+ characters (not a placeholder) in production.`);
  }

  if (!secret || secret.length < MIN_SECRET_LENGTH || isPlaceholderSecret(secret) || secret === password) {
    throw new Error(
      `ADMIN_SESSION_SECRET must be ${MIN_SECRET_LENGTH}+ random characters, not a placeholder and not the password, in production.`
    );
  }

  return { password, secret };
}
