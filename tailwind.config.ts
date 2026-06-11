import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        clay: "#8f5e4d",
        moss: "#4f6f5b",
        mist: "#f5f3ef",
        line: "#e8e2da"
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
        serif: ["Georgia", "Times New Roman", "serif"]
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 23, 23, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
