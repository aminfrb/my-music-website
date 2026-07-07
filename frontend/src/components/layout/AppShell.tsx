"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PlayerBar } from "./PlayerBar";
import { CornerSpiderWeb } from "@/components/ui/CornerSpiderWeb";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* A small spider-web with a dangling spider, tucked into the top corner
          on the side opposite the sidebar: top-right in LTR, top-left (mirrored)
          in RTL so it never sits behind the Persian sidebar. Fixed + behind
          content + hidden on phones so it never affects the responsive layout. */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-0 -z-10 hidden overflow-hidden sm:block ltr:right-0 rtl:left-0"
      >
        <CornerSpiderWeb className="h-[280px] w-[150px] text-primary/25 lg:h-[330px] lg:w-[180px] rtl:[transform:scaleX(-1)]" />
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
