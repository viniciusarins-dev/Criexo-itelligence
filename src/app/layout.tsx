import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import type { ReactNode } from "react";

import { MotionProvider } from "@/components/layout/motion-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "CRIEXO Intelligence", template: "%s · CRIEXO Intelligence" },
  description: "Sistema interno de prospecção comercial da CRIEXO Soluções Criativas.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#080808",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <body className="min-h-dvh">
        <MotionProvider>{children}</MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}
