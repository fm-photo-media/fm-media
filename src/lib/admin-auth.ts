import crypto from "crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "fm_media_admin";

function adminPassword() {
  const password = process.env.ADMIN_PASSWORD;

  if (process.env.NODE_ENV === "production" && (!password || password === "change-me")) {
    throw new Error("ADMIN_PASSWORD must be set to a secure value in production.");
  }

  return password ?? "change-me";
}

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (process.env.NODE_ENV === "production" && (!secret || secret === "local-development-secret")) {
    throw new Error("ADMIN_SESSION_SECRET must be set to a secure value in production.");
  }

  return secret ?? adminPassword();
}

export function verifyAdminPassword(password: string) {
  return safeEqual(password, adminPassword());
}

function sessionValue() {
  return crypto.createHmac("sha256", sessionSecret()).update(`admin:${adminPassword()}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_COOKIE)?.value;
  return value ? safeEqual(value, sessionValue()) : false;
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    throw new Error("Unauthorized admin request.");
  }
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, sessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}
