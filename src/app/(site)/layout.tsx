import { BusinessJsonLd } from "@/components/business-json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// Batch 5: the public shell. Every public page gets the logo header and the card footer;
// the admin has its own shell (app/admin/layout.tsx).
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <BusinessJsonLd />
    </>
  );
}
