import type { Config } from "tailwindcss";

// Batch 5 / 5b: the public site is styled by the component classes in globals.css and the
// admin by app/admin/admin.css (brand tokens as CSS variables). Tailwind now supplies only
// its base reset (preflight); no page uses its utility classes, so no colour tokens are kept
// here (the old cream/clay palette is gone).
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"]
      }
    }
  },
  plugins: []
};

export default config;
