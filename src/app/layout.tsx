import type { Metadata } from "next";
import { Newsreader, Archivo } from "next/font/google";
import "./globals.css";

/**
 * Newsreader carries titles and editorial text; Archivo carries UI and metadata.
 *
 * Both are loaded through next/font, which downloads and self-hosts the files at build
 * time — the browser makes zero requests to Google, so there are no third-party cookies
 * and no consent banner for an app that otherwise sets nothing.
 */
const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Archivo({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ensemble",
  description:
    "A film and television tracker built around the connections between what you watch — franchises, casts, and whether a series is still running.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="bg-paper text-ink font-sans text-body min-h-full">{children}</body>
    </html>
  );
}
