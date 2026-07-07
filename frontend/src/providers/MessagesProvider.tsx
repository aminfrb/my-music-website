"use client";

import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSocket, disconnectSocket, onSocket } from "@/lib/socket";
import type { RealtimeMessage } from "@/lib/types";
import { useAuth } from "./AuthProvider";

/**
 * Keeps the realtime socket connected while signed in and turns incoming
 * `message:new` events into React Query cache invalidations so open views
 * (conversation list, unread badges, the active thread) refresh live.
 */
export function MessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }
    connectSocket();

    const off = onSocket("message:new", (raw) => {
      const msg = raw as RealtimeMessage;
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
      const peerId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
      queryClient.invalidateQueries({ queryKey: ["messages", peerId] });
    });

    return () => {
      off();
    };
  }, [user, queryClient]);

  return <>{children}</>;
}
