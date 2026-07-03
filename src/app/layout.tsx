import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sqlstudio.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SQL Studio — AI-Powered Browser SQLite Workspace",
    template: "%s | SQL Studio",
  },
  description:
    "SQL Studio is a premium, offline-first SQLite workspace running entirely in your browser. Write queries with Monaco autocomplete, design schemas visually, seed mock data, and chat with an AI Copilot — no server, no data leaks.",
  keywords: [
    "SQL editor",
    "SQLite browser",
    "browser SQL IDE",
    "WebAssembly SQLite",
    "AI SQL copilot",
    "schema designer",
    "mock data seeder",
    "offline SQL",
    "database IDE",
    "sql.js",
    "SQL Studio",
    "client-side database",
  ],
  authors: [{ name: "SQL Studio Team", url: SITE_URL }],
  creator: "SQL Studio",
  publisher: "SQL Studio",
  category: "Developer Tools",

  // Canonical & alternates
  alternates: {
    canonical: SITE_URL,
  },

  // Open Graph
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "SQL Studio — AI-Powered Browser SQLite Workspace",
    description:
      "A premium offline-first SQL IDE for the browser. Monaco editor, AI Copilot, visual schema designer, mock data seeder — all running locally in WebAssembly.",
    siteName: "SQL Studio",
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "SQL Studio — Browser-native SQLite IDE with AI Copilot",
      },
    ],
  },

  // Twitter / X Cards
  twitter: {
    card: "summary_large_image",
    title: "SQL Studio — AI-Powered Browser SQLite Workspace",
    description:
      "Offline-first SQLite IDE in your browser. Monaco editor, AI Copilot, visual schema designer & mock data seeder.",
    images: [`${SITE_URL}/og-image.png`],
    creator: "@sqlstudio",
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Icons
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  // Manifest
  manifest: "/site.webmanifest",

  // App
  applicationName: "SQL Studio",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

// Viewport — themeColor must live here in Next.js 16+
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Structured data — SoftwareApplication JSON-LD
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SQL Studio",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "A premium browser-native SQLite IDE with Monaco editor, AI Copilot, visual schema designer, and mock data seeder. Runs entirely client-side in WebAssembly.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "SQLite WebAssembly execution",
    "Monaco autocomplete editor",
    "AI SQL Copilot",
    "Visual ER schema designer",
    "Mock data seeder",
    "Schema diff & migrations",
    "100% offline, no data sent to servers",
  ],
  screenshot: `${SITE_URL}/og-image.png`,
  softwareVersion: "1.0.0",
};

import CommandPalette from "../components/dx/CommandPalette";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <CommandPalette />
      </body>
    </html>
  );
}
