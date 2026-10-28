import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "About",
  description: "FM Media is a Chicagoland real estate photography business owned by Francisco Martinez."
};

export default function AboutPage() {
  return (
    // 4.22: the About photo is gone until Francisco supplies his own (or a portrait).
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-center">
        <SectionHeading
          eyebrow="About"
          title="A photography partner built for modern property marketing."
          copy="FM Media is owned by Francisco Martinez and photographs homes, apartments and rentals across Chicagoland. The work is clean, useful, and edited to make spaces feel true to life."
          level="h1"
        />
        <div className="mt-8 grid gap-5 text-ink/70">
          <p>
            The process is lean: confirm scope, shoot with a clear list, edit for accuracy, and deliver files ready for MLS, social, rental platforms, and print.
          </p>
          <p>
            The goal is simple: give agents and property teams a reliable image partner who respects listing timelines, brand standards, and the details that make a space feel considered.
          </p>
        </div>
        <Link href="/contact" className="focus-ring mt-8 inline-flex w-fit rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-clay">
          Start a Booking
        </Link>
      </div>
    </main>
  );
}
