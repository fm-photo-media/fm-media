import type { MetadataRoute } from "next";

// Batch 5: the web manifest, with Francisco's logo as the app icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FM Media",
    short_name: "FM Media",
    description: "Real estate photography and video in Chicagoland.",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#044fb5",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
