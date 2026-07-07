"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ConversationList } from "./ConversationList";

/**
 * Two-pane messages layout. On desktop the conversation list and the open
 * thread sit side by side; on mobile only one shows at a time (the list at
 * `/messages`, the thread at `/messages/[id]`).
 */
export function MessagesShell({
  activeUserId,
  children,
}: {
  activeUserId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[26rem] gap-4">
      <div className={cn("w-full shrink-0 lg:w-80", activeUserId && "hidden lg:block")}>
        <ConversationList activeUserId={activeUserId} />
      </div>
      <div className={cn("min-w-0 flex-1", !activeUserId && "hidden lg:block")}>{children}</div>
    </div>
  );
}
