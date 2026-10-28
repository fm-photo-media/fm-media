import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

// LEG-1: text from src/content/legal/terms.md (Legal's legal/terms.md).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for FM Media's website and real estate photography, video, drone and floor plan services."
};

export default function TermsPage() {
  return <LegalPage file="terms.md" />;
}
