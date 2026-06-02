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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Blocking script: Force dark mode BEFORE first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            // Read theme preference from localStorage
            var theme = localStorage.getItem('aether-theme');
            // Also check the aether-dark-mode key used by the store
            var darkMode = localStorage.getItem('aether-dark-mode');
            
            var isDark = true; // Default to dark
            if (theme === 'light') isDark = false;
            if (darkMode === 'false') isDark = false;
            
            if (isDark) {
              document.documentElement.classList.add('dark');
              document.documentElement.setAttribute('data-theme', 'dark');
            } else {
              document.documentElement.classList.remove('dark');
              document.documentElement.setAttribute('data-theme', 'light');
            }
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
