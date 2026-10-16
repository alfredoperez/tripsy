import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter_Tight } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
import "./globals.css";

// Inter Tight: a tight grotesk that holds up at 800 for uppercase headlines
// and at 300 for the light second line.
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tripsy",
  description: "Shared trip itineraries",
  // The page is light now, so the status bar keeps dark text.
  appleWebApp: { capable: true, title: "Tripsy", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f2f2f0",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
