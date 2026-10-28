import type { Metadata, Viewport } from "next";
import { bodoni, dash, josefin } from "@/app/fonts";
import { METADATA_BASE } from "@/lib/site";
import "./globals.css";

// Batch 5: the public header and footer live in app/(site)/layout.tsx and the admin shell
// in app/admin/layout.tsx. Icons, the manifest and the share image come from the app/
// file conventions (favicon.ico, icon.png, apple-icon.png, opengraph-image.png, manifest.ts).
export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE),
  title: {
    default: "FM Media | Real Estate Photography in Chicagoland",
    template: "%s | FM Media"
  },
  description:
    "Real estate photography and video for homes, apartments and short-term rentals across Chicagoland.",
  applicationName: "FM Media",
  openGraph: {
    title: "FM Media",
    description: "Real estate photography and video in Chicagoland.",
    type: "website",
    siteName: "FM Media",
    locale: "en_US"
  },
  twitter: {
    card: "summary_large_image",
    title: "FM Media",
    description: "Real estate photography and video in Chicagoland."
  }
};

export const viewport: Viewport = {
  themeColor: "#044fb5"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${josefin.variable} ${bodoni.variable} ${dash.variable}`}>
      <body>{children}</body>
    </html>
  );
}
