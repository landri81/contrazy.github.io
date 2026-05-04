import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/app/providers";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();
const siteDescription = "Contract, KYC, signature, deposit and payment in one secure workflow.";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Contrazy",
  description: siteDescription,
  applicationName: "Contrazy",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/favicon.png",
        type: "image/png",
        sizes: "64x64",
      },
      {
        url: "/apple-touch-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
      {
        url: "/icon-512.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    shortcut: [
      {
        url: "/favicon.png",
        type: "image/png",
        sizes: "64x64",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Contrazy",
    title: "Contrazy",
    description: siteDescription,
    images: [
      {
        url: "/logo/logo-contrazy-dark.png",
        alt: "Contrazy",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Contrazy",
    description: siteDescription,
    images: ["/logo/logo-contrazy-dark.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Contrazy",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c1e2f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
