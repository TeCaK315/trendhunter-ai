import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import ClientLayout from "@/components/layout/ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Site configuration
const siteConfig = {
  name: "TrendHunter AI",
  description: "AI-powered platform for trend analysis, niche research, and startup idea generation. Real data from Google Trends, Reddit, YouTube.",
  descriptionRu: "AI-платформа для анализа трендов, исследования ниш и генерации идей для стартапов. Реальные данные из Google Trends, Reddit, YouTube.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://trendhunter-ai.vercel.app",
  image: "/og-image.png", // 1200x630 recommended for Open Graph
  twitterHandle: "@trendhunterai",
};

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} - Trend Analysis & Startup Ideas Platform`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "AI trends",
    "startup ideas",
    "market research",
    "niche analysis",
    "business opportunities",
    "trend hunting",
    "AI platform",
    "Google Trends",
    "Reddit analysis",
    "market opportunities",
    "AI анализ",
    "стартап идеи",
    "исследование рынка",
    "анализ трендов",
  ],
  authors: [{ name: "TrendHunter AI Team" }],
  creator: "TrendHunter AI",
  publisher: "TrendHunter AI",

  // Open Graph - for Facebook, LinkedIn, etc.
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: "ru_RU",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} - AI-Powered Trend Analysis`,
    description: siteConfig.description,
    images: [
      {
        url: `${siteConfig.url}${siteConfig.image}`,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - Discover trends and startup opportunities`,
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} - AI-Powered Trend Analysis`,
    description: siteConfig.description,
    images: [`${siteConfig.url}${siteConfig.image}`],
    creator: siteConfig.twitterHandle,
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
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },

  // Manifest for PWA
  manifest: "/manifest.json",

  // Additional metadata
  metadataBase: new URL(siteConfig.url),
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/en",
      "ru-RU": "/ru",
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Preconnect to external services */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Structured data for search engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: siteConfig.name,
              description: siteConfig.description,
              url: siteConfig.url,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Any",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              featureList: [
                "AI-powered trend analysis",
                "Market research automation",
                "Startup idea generation",
                "Competitor analysis",
                "Real-time data from Google Trends, Reddit, YouTube",
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#09090b]`}
      >
        <ClientLayout>{children}</ClientLayout>
        <Analytics />
      </body>
    </html>
  );
}
