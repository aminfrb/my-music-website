"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PlayerBar } from "./PlayerBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
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
