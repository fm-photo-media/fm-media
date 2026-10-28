import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  SESSION_TTL_MS,
  adminSecretsFrom,
  createSession,
  revokeAllSessions,
  revokeSession,
  validateSession,
  type SessionStore
} from "@/lib/admin-session";

// SEC-2 / SEC-12: a random, server-side session per sign-in (see admin-session.ts),
// in a cookie that is httpOnly, Secure, SameSite=Strict and Path=/. In production the
// name carries the __Host- prefix, which makes the browser enforce Secure, Path=/ and no
// Domain. (Over plain http on localhost a __Host- cookie can't be set, so dev drops it.)
const isProduction = process.env.NODE_ENV === "production";
export const ADMIN_COOKIE = isProduction ? "__Host-fm_media_admin" : "fm_media_admin";

function secrets() {
  return adminSecretsFrom(process.env);
}

export const prismaSessionStore: SessionStore = {
  create: async (row) => {
    await prisma.adminSession.create({ data: row });
  },
  find: (id) => prisma.adminSession.findUnique({ where: { id }, select: { expiresAt: true } }),
  delete: async (id) => {
    await prisma.adminSession.deleteMany({ where: { id } });
  },
  deleteExpired: async (now) => {
    await prisma.adminSession.deleteMany({ where: { expiresAt: { lte: now } } });
  },
  deleteAll: async () => {
    await prisma.adminSession.deleteMany({});
  }
};

/** Constant-time compare that doesn't leak the password's length. */
export function verifyAdminPassword(password: string) {
  const digest = (value: string) => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(password), digest(secrets().password));
}

/**
 * Checked on every admin page, route and action: the cookie must name a stored,
 * unexpired session. Any error (DB down, bad config) counts as signed out.
 */
export async function isAdminAuthenticated() {
  try {
    const token = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (!token) return false;
    return await validateSession(prismaSessionStore, secrets().secret, token);
  } catch (error) {
    console.error("[admin-auth] session check failed; treating as signed out", error);
    return false;
  }
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    throw new Error("Unauthorized admin request.");
  }
}

export async function setAdminSession() {
  const { token, expiresAt } = await createSession(prismaSessionStore, secrets().secret);
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_TTL_MS / 1000
  });
}

/** Logout: revoke this session server-side, then drop the cookie. */
export async function clearAdminSession({ everywhere = false } = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  try {
    if (everywhere) {
      await revokeAllSessions(prismaSessionStore);
    } else {
      await revokeSession(prismaSessionStore, secrets().secret, token);
    }
  } finally {
    // Expire it with the same attributes; a __Host- cookie is only replaced by a Secure one.
    cookieStore.set(ADMIN_COOKIE, "", { httpOnly: true, secure: isProduction, sameSite: "strict", path: "/", maxAge: 0 });
  }
}
