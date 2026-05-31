import type { Metadata } from "next";
import { Inter, Playfair_Display, DM_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aether — Your AI-Powered Second Brain",
  description:
    "Aether remembers everything—so you don't have to. Capture ideas, voice notes, links, and more. Retrieve any memory instantly with natural language AI search.",
  keywords: [
    "Aether",
    "second brain",
    "AI memory",
    "note-taking",
    "voice notes",
    "semantic search",
    "productivity",
  ],
  authors: [{ name: "Aether" }],
  icons: {
    icon: [
      { url: "/aether-icon.svg", type: "image/svg+xml" },
      { url: "/aether-logo.png", type: "image/png", sizes: "1024x1024" },
    ],
    apple: "/aether-logo.png",
  },
  openGraph: {
    title: "Aether — Your AI-Powered Second Brain",
    description:
      "Forget forgetting. Aether remembers everything—so you don't have to.",
    type: "website",
    siteName: "Aether",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aether — Your AI-Powered Second Brain",
    description:
      "Forget forgetting. Aether remembers everything—so you don't have to.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            // Force dark mode always — deep space is the default
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
          })();
        `}} />
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} ${dmMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
