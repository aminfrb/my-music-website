"use client";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { MessagesShell } from "@/components/messages/MessagesShell";
import { ChatThread } from "@/components/messages/ChatThread";

export default function ThreadPage({ params }: { params: { userId: string } }) {
  const { userId } = params;
  return (
    <RequireAuth>
      <MessagesShell activeUserId={userId}>
        <ChatThread peerId={userId} />
      </MessagesShell>
    </RequireAuth>
  );
}
