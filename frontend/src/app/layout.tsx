import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/app/common";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Display serif for the logo and headlines (a free look-alike of the high-contrast serifs in the saved design references).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

// Hairline editorial serif for the biggest moments (greeting, key numbers): a free look-alike of
// "Maison Salome" from the saved design references.
const instrumentSerif = Instrument_Serif({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Trip Optimizer",
  description: "Smarter travel. Better decisions. For your business.",
  applicationName: "AI Trip Optimizer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
