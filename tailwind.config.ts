import type { Config } from "tailwindcss";

// Batch 5: the public site is styled by the component classes in globals.css (brand tokens
// as CSS variables). These Tailwind tokens remain for the admin screens until batch 5b.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f1722",
        blue: { DEFAULT: "#044fb5", deep: "#033a85" },
        tint: "#eef3fb",
        clay: "#8f5e4d",
        moss: "#4f6f5b",
        mist: "#f5f3ef",
        line: "#e8e2da"
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"]
      }
    }
  },
  plugins: []
};

export default config;
