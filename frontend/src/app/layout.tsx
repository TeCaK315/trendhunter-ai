import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "TrendHunter AI - Платформа поиска трендов и идей для стартапов",
  description: "AI-платформа для анализа трендов, исследования ниш и генерации идей для бизнеса. Реальные данные из Google Trends, Reddit, YouTube.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#09090b]`}
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
