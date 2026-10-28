import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginAdmin } from "@/app/actions";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { loginWaitMessage } from "@/lib/rate-limit";

// QA-3: rendered per request so the query string (errors, notices) is read.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Login",
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
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-line bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-clay">Admin</p>
        <h1 className="mt-3 font-serif text-3xl text-ink">Sign in</h1>
        {notice ? (
          <p className="mt-4 text-sm font-medium text-ink" role="status">
            {notice}
          </p>
        ) : null}
        <form action={loginAdmin} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={errorText ? true : undefined}
              aria-describedby={errorText ? "login-error" : undefined}
              className="rounded-md border border-line px-3 py-2"
            />
          </label>
          {errorText ? (
            <p id="login-error" className="text-sm font-medium text-clay" role="alert">
              {errorText}
            </p>
          ) : null}
          <button className="focus-ring rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-clay">
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}
