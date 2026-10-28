import { Bodoni_Moda, Josefin_Sans } from "next/font/google";
import localFont from "next/font/local";

// Legal ship condition B: next/font downloads these at build time and serves them from
// our own domain. No request goes to Google (or any font CDN) from a visitor's browser.

// The wordmark voice: headings, navigation, buttons and the facts (phone, email, prices).
export const josefin = Josefin_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-josefin"
});

// The business card's serif: the lede, "Real Estate Media" and running text at 18px+.
export const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
  variable: "--font-bodoni"
});

// Bodoni Moda's hyphen is a hairline that vanishes at text sizes, so "(312) 375-5209" read
// as "(312) 375 5209". This face draws only hyphens, dashes and minus from Josefin
// (unicode-range), and is listed before Bodoni in --font-serif.
export const dash = localFont({
  src: "../fonts/josefin-dash.woff2",
  weight: "100 700",
  display: "swap",
  variable: "--font-dash",
  fallback: [],
  adjustFontFallback: false,
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+002D, U+2010-2014, U+2212" }]
});
