/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires 'unsafe-inline' for its runtime styles in dev;
              // in production consider a nonce-based approach.
              "style-src 'self' 'unsafe-inline'",
              // Next.js hydration and turbopack need 'unsafe-eval' in dev only.
              // Script worker for PDF.js is served from /pdf.worker.min.mjs.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "worker-src 'self' blob:",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              // Supabase API calls
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
