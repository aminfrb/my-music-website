import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/providers/Providers";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Spidermelody · Discover, play & share music",
  description:
    "Spidermelody — a bilingual social music platform to upload, discover, play, save, react to and get recommendations for music.",
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
      <head>
        {/* Apply the saved theme before first paint to avoid a flash.
            Keep the key in sync with ThemeProvider. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('spidermelody.theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();",
          }}
        />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
