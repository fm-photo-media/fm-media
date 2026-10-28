import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAdmin } from "@/app/actions";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { loginWaitMessage } from "@/lib/rate-limit";

// QA-3: rendered per request so the query string (errors, notices) is read.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Secure sign-in for FM Media site administration.",
  robots: { index: false, follow: false }
};

function loginError(error: string | undefined, wait: string | undefined) {
  if (!error) return null;
  // Waits run up to 1440 minutes now that there is a 20-a-day limit.
  if (error === "rate-limited") return loginWaitMessage(wait);
  if (error === "unavailable") return "Sign-in is unavailable right now. Please try again in a few minutes.";
  return "That password did not work.";
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
    <main className="flex min-h-[100svh] items-center justify-center px-4 py-10">
      {/* Batch 5 (design.md admin login): a centred card with a blue top band and the full logo. */}
      <div className="w-full max-w-[400px] border border-[#e1e7f0] border-t-[6px] border-t-blue bg-white p-8">
        <Image src="/brand/logo-full.png" width={564} height={519} alt="FM Media" priority sizes="120px" className="mx-auto h-auto w-[120px]" />
        <h1 className="mt-5 text-center text-2xl font-semibold text-ink">Admin sign in</h1>
        {notice ? (
          <p className="mt-4 bg-tint px-3 py-2 text-sm font-medium text-ink" role="status">
            {notice}
          </p>
        ) : null}
        <form action={loginAdmin} className="mt-6 grid gap-4">
          {errorText ? (
            <p id="login-error" className="bg-[#fdecea] px-3 py-2 text-sm font-medium text-[#8a1c12]" role="alert">
              {errorText}
            </p>
          ) : null}
          <label className="grid gap-2 text-sm font-medium text-ink">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={errorText ? true : undefined}
              aria-describedby={errorText ? "login-error" : undefined}
              className="min-h-[44px] border border-[#6b7380] px-3 py-2"
            />
          </label>
          <button className="focus-ring min-h-[44px] w-full bg-blue px-5 text-sm font-semibold text-white hover:bg-blue-deep">Sign in</button>
        </form>
        <p className="mt-5 text-center text-sm text-ink/75">
          For the owner of fm-media.org only.{" "}
          <Link href="/" className="focus-ring inline-flex min-h-[44px] items-center underline">
            Back to the site
          </Link>
        </p>
      </div>
    </main>
  );
}
