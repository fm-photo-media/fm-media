import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./admin.css";

// Batch 5: Jost (real tabular figures) is loaded for the admin only; the public pages
// never request it. Self-hosted by next/font (Legal ship condition B).
// Batch 5b: the admin's own stylesheet (admin.css, every class scoped under .admin / ad-).
const jost = Jost({ subsets: ["latin"], weight: "variable", display: "swap", variable: "--font-jost" });

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | FM Media admin" },
  robots: { index: false, follow: false }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`admin ${jost.variable}`}>{children}</div>;
}
