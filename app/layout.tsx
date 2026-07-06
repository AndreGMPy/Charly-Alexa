import PublicChrome from "@/components/PublicChrome";
import { storeConfig } from "@/lib/site";
import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const fredoka = Fredoka({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${storeConfig.name} | ${storeConfig.tagline}`,
  description: storeConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${nunito.variable} ${fredoka.variable}`}>
        <PublicChrome>{children}</PublicChrome>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
