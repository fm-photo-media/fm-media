import { BUSINESS } from "@/lib/business";
import { serializeJsonLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/site";

// Batch 5 SEO: LocalBusiness with ONLY the known facts (name, phone, email, Chicagoland).
// No street address, no ratings, no opening hours, no price claims.
export function businessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: BUSINESS.name,
    url: SITE_URL,
    telephone: BUSINESS.phoneE164,
    email: BUSINESS.email,
    image: `${SITE_URL}/brand/logo-full.png`,
    logo: `${SITE_URL}/brand/logo-full.png`,
    areaServed: { "@type": "Place", name: BUSINESS.serviceArea }
  };
}

export function BusinessJsonLd() {
  // Static data from constants today; serializeJsonLd escapes < > & U+2028 U+2029 anyway (SEC-26).
  const json = serializeJsonLd(businessJsonLd());
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
