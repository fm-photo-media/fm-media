import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <h1 className="font-serif text-5xl">Page not found</h1>
      <p className="mt-4 max-w-xl text-ink/70">The page may have moved, or the shoot you wanted is already off the board.</p>
      <Link href="/" className="focus-ring mt-8 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
        Return Home
      </Link>
    </main>
  );
}
