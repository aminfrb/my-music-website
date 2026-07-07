import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/providers/Providers";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Harmony · Discover, play & share music",
  description:
    "Harmony — a bilingual social music platform to upload, discover, play, save, react to and get recommendations for music.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08080f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // lang/dir are set client-side by LocaleProvider once the stored locale loads.
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
