import { imageHostForBuild } from "./src/lib/blob-host.mjs";

// SEC-25: images and the CSP img-src are pinned to our own public Blob store, from
// BLOB_READ_WRITE_TOKEN at build time. Without the token: the old wildcard, plus a warning.
const blobImageHost = imageHostForBuild(process.env.BLOB_READ_WRITE_TOKEN);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // SEC-4 / QA-6 (batch 3): 1mb for every action, public ones included. Admin image
      // files over 900 KB (SERVER_UPLOAD_BYTES in src/lib/upload.ts) go browser -> Blob
      // through /api/gallery-upload, on both "add" and "replace", so nothing needs more.
      bodySizeLimit: "1mb"
    }
  },
  // Batch 5 (DES-9): Services and Pricing are one page now. `permanent: true` sends a 308.
  async redirects() {
    return [{ source: "/pricing", destination: "/services", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // QA-21: `upload()` from @vercel/blob/client (2.4.0) PUTs the file to
          // https://vercel.com/api/blob/ (and /api/blob/mpu for multipart). connect-src
          // allows only that path prefix, not the whole vercel.com origin.
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://${blobImageHost}; font-src 'self' data:; connect-src 'self' https://api.resend.com https://*.blob.vercel-storage.com https://vercel.com/api/blob/`
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()"
          }
        ]
      }
    ];
  },
  images: {
    // LEG-9 / SEC-25: only our own Blob store's gallery uploads (plus local /public files,
    // which need no pattern). No stock-photo hosts, so outside images can never be shown.
    remotePatterns: [
      {
        protocol: "https",
        hostname: blobImageHost,
        pathname: "/gallery/**"
      }
    ],
    formats: ["image/avif", "image/webp"]
  }
};

export default nextConfig;
