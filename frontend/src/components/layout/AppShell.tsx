"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PlayerBar } from "./PlayerBar";
import { SpiderWeb } from "@/components/ui/SpiderWeb";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Decorative spider webs spun into two corners — purely ornamental. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <SpiderWeb className="absolute -right-28 -top-28 h-72 w-72 text-primary/[0.07] sm:h-96 sm:w-96" />
        <SpiderWeb className="absolute -bottom-28 -left-28 h-64 w-64 text-accent/[0.06] sm:h-80 sm:w-80" />
      </div>
      <Sidebar />
      <div className="lg:ltr:pl-64 lg:rtl:pr-64">
        <TopBar />
        {/* Bottom padding leaves room for the fixed player bar. */}
        <main className="mx-auto max-w-7xl px-4 pb-40 pt-6 sm:px-6">{children}</main>
      </div>
      <PlayerBar />
    </div>
  );
}
