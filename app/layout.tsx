import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AutoGenerationHeartbeat from "./AutoGenerationHeartbeat";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Idea Engine",
  description: "Capture ideas, shape your voice, generate drafts, and review them in one loop.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AutoGenerationHeartbeat />
        {children}
      </body>
    </html>
  );
}
