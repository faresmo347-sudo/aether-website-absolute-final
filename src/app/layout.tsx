import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Blocking script: restore dark mode & background BEFORE first paint
            to prevent flash of wrong theme. Reads from aether-settings (Zustand persist)
            with fallback to aether-dark-mode (legacy key). */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var isDark = false;
              // Try new settings key first
              var settings = localStorage.getItem('aether-settings');
              if (settings) {
                var parsed = JSON.parse(settings);
                isDark = !!parsed.darkMode;
              } else {
                // Fallback to legacy key
                isDark = localStorage.getItem('aether-dark-mode') === 'true';
              }
              if (isDark) {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
              } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
              }
            } catch(e) {
              document.documentElement.classList.add('light');
            }
          })();
        `}} />
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} antialiased min-h-dvh flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
