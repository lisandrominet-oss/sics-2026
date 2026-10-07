import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./dark-theme.css";
import ThemeWatcher from "@/components/ThemeWatcher";
import { Suspense } from "react";
import AppToaster from "@/components/ui/AppToaster";
import NavProgress from "@/components/NavProgress";
import ConfirmProvider from "@/components/ui/ConfirmProvider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Servicios Industriales",
  description: "Gestión de solicitudes internas de compra",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">
        <ThemeWatcher />
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <ConfirmProvider>{children}</ConfirmProvider>
        <AppToaster />
      </body>
    </html>
  );
}
