import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "FM Media | Real Estate Photography",
    template: "%s | FM Media"
  },
  description:
    "Real estate photography and video for homes, apartments and short-term rentals across Chicagoland.",
  openGraph: {
    title: "FM Media",
    description: "Real estate photography and video in Chicagoland.",
    type: "website"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
