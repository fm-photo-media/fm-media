import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "About",
  description: "A premium real estate photography studio focused on speed, polish, and property marketing."
};

export default function AboutPage() {
  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
      <div className="relative min-h-[440px] overflow-hidden rounded-lg shadow-soft">
        <Image
          src="/images/portfolio/real-estate-photo-04.jpg"
          alt="Living room real estate photo from a residential property shoot"
          fill
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col justify-center">
        <SectionHeading
          eyebrow="About"
          title="A photography partner built for modern property marketing."
          copy="FM Media pairs architectural composition with realtor-friendly speed. The work is clean, useful, and edited to make spaces feel true to life."
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
