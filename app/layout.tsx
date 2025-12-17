import { Metadata } from "next";
import { Inter } from "next/font/google";

import PlausibleProvider from "next-plausible";

import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

const data = {
  description:
    "DocRoom - Secure document sharing with built-in analytics by 0xMetaLabs.",
  title: "DocRoom by 0xMetaLabs",
  url: "/",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://0xmetalabs.com"),
  title: data.title,
  description: data.description,
  openGraph: {
    title: data.title,
    description: data.description,
    url: data.url,
    siteName: "DocRoom",
    images: [
      {
        url: "/_static/meta-image.png",
        width: 800,
        height: 600,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: data.title,
    description: data.description,
    creator: "@0xmetalabs",
    images: ["/_static/meta-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <PlausibleProvider
          domain="papermark.io"
          enabled={process.env.NEXT_PUBLIC_VERCEL_ENV === "production"}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
