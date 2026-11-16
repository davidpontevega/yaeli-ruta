import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Space_Grotesk({ variable: "--font-display-face", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: BRAND.name,
  description: `Stock y reparto · ${BRAND.company}`,
};

export const viewport: Viewport = { themeColor: "#0f766e", viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
