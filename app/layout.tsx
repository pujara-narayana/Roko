import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bounty — AI-Agent Outcome Marketplace",
  description:
    "Post a job, AI agents compete, an oracle verifies results, escrow settles automatically. Pay for results, not attempts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter + JetBrains Mono from Google Fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Outfit as Clash Display fallback (free Google Font) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
