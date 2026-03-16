
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { LangProvider } from "@/contexts/LangContext";

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Finrush Agent",
  description: "Live AI Financial Assistant powered by Gemini",
  icons: {
    icon: [
      { url: "/logo/finrush-192.png", sizes: "192x192", type: "image/png" },
      { url: "/logo/finrush_favicon_fr.svg", type: "image/svg+xml" },
    ],
    apple: "/logo/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Finrush",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="font-sans antialiased"
      >
        <LangProvider>{children}</LangProvider>
        <Script
          id="register-sw"
          strategy="afterInteractive"
        >
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
