import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ─── Security Headers ──────────────────────────────────────────────────────
  async headers() {
    const securityHeaders = [
      // Prevent MIME-type sniffing
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      // Block framing to prevent clickjacking
      {
        key: "X-Frame-Options",
        value: "SAMEORIGIN",
      },
      // Restrict referrer information
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      // Force HTTPS for 1 year (only effective once deployed to HTTPS)
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      },
      // Disable browser features not needed
      {
        key: "Permissions-Policy",
        value: [
          "camera=()",
          "microphone=()",
          "geolocation=()",
          "payment=()",
          "usb=()",
          "magnetometer=()",
          "gyroscope=()",
          "accelerometer=()",
        ].join(", "),
      },
      // Cross-Origin policies
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin",
      },
      {
        key: "Cross-Origin-Resource-Policy",
        value: "same-origin",
      },
      {
        key: "Cross-Origin-Embedder-Policy",
        value: "require-corp",
      },
      // Content-Security-Policy
      // NOTE: 'unsafe-eval' is required for sql.js (WASM JIT) and Monaco editor.
      // 'unsafe-inline' is required for inline styles used by Monaco.
      // blob: is needed for sql.js worker loading.
      {
        key: "Content-Security-Policy",
        value: [
          `default-src 'self'`,
          `script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:`,
          `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
          `font-src 'self' https://fonts.gstatic.com`,
          `img-src 'self' data: blob:`,
          `media-src 'none'`,
          `connect-src 'self' https://*.huggingface.co https://huggingface.co https://api.groq.com blob:`,
          `worker-src 'self' blob:`,
          `child-src blob:`,
          `frame-src 'none'`,
          `object-src 'none'`,
          `base-uri 'self'`,
          `form-action 'self'`,
          `upgrade-insecure-requests`,
        ].join("; "),
      },
    ];

    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // ─── Performance ──────────────────────────────────────────────────────────
  compress: true,

  // ─── Images ───────────────────────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
