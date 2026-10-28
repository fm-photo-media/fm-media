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
              "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.unsplash.com https://*.public.blob.vercel-storage.com; font-src 'self' data:; connect-src 'self' https://api.resend.com https://*.blob.vercel-storage.com https://vercel.com/api/blob/"
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com"
      }
    ],
    formats: ["image/avif", "image/webp"]
  }
};

export default nextConfig;
