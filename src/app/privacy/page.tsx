import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

// LEG-1: text from src/content/legal/privacy.md (Legal's legal/privacy.md).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How FM Media handles the personal information sent through its booking form."
};

export default function PrivacyPage() {
  return <LegalPage file="privacy.md" />;
}
