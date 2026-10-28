import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAdmin } from "@/app/actions";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { loginWaitMessage, wrongPasswordMessage } from "@/lib/rate-limit";

// QA-3: rendered per request so the query string (errors, notices) is read.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Secure sign-in for FM Media site administration.",
  robots: { index: false, follow: false }
};

function loginError(error: string | undefined, wait: string | undefined) {
  if (!error) return null;
  // An actual lockout gives the real wait (up to 1440 minutes with the 20-a-day limit).
  if (error === "rate-limited") return loginWaitMessage(wait);
  if (error === "unavailable") return "Sign-in is unavailable right now. Please try again in a few minutes.";
  // Batch 5b: built from the throttle's own constants (SEC-3), so it can't drift.
  return wrongPasswordMessage();
}

const loginNotices: Record<string, string> = {
  "signed-out": "You are signed out.",
  "signed-out-everywhere": "You are signed out on every device."
};

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string; wait?: string }>;
}) {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  const { error, success, wait } = await searchParams;
  const errorText = loginError(error, wait);
  const notice = success ? loginNotices[success] : undefined;

  return (
    <main className="ad-login">
      {/* design.md admin login: a centred 400px card, 6px blue top band, logo-full at 120px. */}
      <div className="ad-login__card">
        <Image src="/brand/logo-full.png" width={564} height={519} alt="FM Media" priority sizes="120px" />
        <h1>Admin sign in</h1>
        {notice ? (
          <p className="ad-login__msg" role="status">
            {notice}
          </p>
        ) : null}
        <form action={loginAdmin} className="ad-login__form">
          {errorText ? (
            <p id="login-error" className="ad-login__err" role="alert">
              {errorText}
            </p>
          ) : null}
          <div className="ad-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={errorText ? true : undefined}
              aria-describedby={errorText ? "login-error" : undefined}
              className="ad-input"
            />
          </div>
          <button className="ad-btn ad-btn--primary">Sign in</button>
        </form>
        <p className="ad-login__note">
          For the owner of fm-media.org only.{" "}
          <Link href="/" className="ad-link">
            Back to the site
          </Link>
        </p>
      </div>
    </main>
  );
}
