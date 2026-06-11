import type { Metadata } from "next";
import { loginAdmin } from "@/app/actions";

export const metadata: Metadata = {
  title: "Admin Login",
  description: "Secure sign-in for FM Media site administration.",
  robots: { index: false, follow: false }
};

export default function AdminLoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-line bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-clay">Admin</p>
        <h1 className="mt-3 font-serif text-3xl text-ink">Sign in</h1>
        <form action={loginAdmin} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-md border border-line px-3 py-2"
            />
          </label>
          {searchParams?.error ? <p className="text-sm font-medium text-clay">That password did not work.</p> : null}
          <button className="focus-ring rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-clay">
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}
