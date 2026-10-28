import { BusinessJsonLd } from "@/components/business-json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { hasPublicPortfolio } from "@/lib/data";
import { navLinks } from "@/lib/site";

// Batch 5: the public shell. Every public page gets the logo header and the card footer;
// the admin has its own shell (app/admin/layout.tsx).
// Batch 7: Portfolio is in the nav only once a public photo exists (site.ts navLinks).
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const nav = navLinks(await hasPublicPortfolio());
  return (
    <>
      <SiteHeader nav={nav} />
      {children}
      <SiteFooter nav={nav} />
      <BusinessJsonLd />
    </>
  );
}
