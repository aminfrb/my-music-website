"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Send } from "lucide-react";
import { gql, GraphQLError } from "@/lib/graphql";
import {
  MARK_CONVERSATION_READ,
  MESSAGES_WITH,
  MESSAGE_PEER,
  SEND_MESSAGE,
} from "@/lib/queries";
import type { Connection, Message, User } from "@/lib/types";
import { cn } from "@/lib/cn";
import { onSocket, sendSocket } from "@/lib/socket";
import { useLocale } from "@/providers/LocaleProvider";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingBlock } from "@/components/ui/States";

function timeLabel(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale === "fa" ? "fa-IR" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ChatThread({ peerId }: { peerId: string }) {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: peerData } = useQuery({
    queryKey: ["messagePeer", peerId],
    queryFn: () => gql<{ user: User | null }>(MESSAGE_PEER, { id: peerId }),
  });
  const peer = peerData?.user ?? null;
  const canMessage = peer ? peer.allowMessages !== false : true;

  const { data, isLoading } = useQuery({
    queryKey: ["messages", peerId],
    queryFn: () =>
      gql<{ messagesWith: Connection<Message> }>(MESSAGES_WITH, { userId: peerId, first: 50 }),
  });

  // API returns newest-first; show oldest → newest.
  const messages = useMemo(
    () => (data?.messagesWith.nodes ?? []).slice().reverse(),
    [data],
  );

  const sendMutation = useMutation({
    mutationFn: (body: string) => gql(SEND_MESSAGE, { toUserId: peerId, body }),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["messages", peerId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // Mark incoming messages read whenever the thread updates.
  useEffect(() => {
    const hasUnread = messages.some((m) => !m.mine && !m.isRead);
    if (!hasUnread) return;
    void gql(MARK_CONVERSATION_READ, { userId: peerId }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
    });
  }, [messages, peerId, queryClient]);

  // Typing indicator from the peer.
  useEffect(() => {
    const off = onSocket("typing", (raw) => {
      const d = raw as { fromUserId?: string };
      if (d.fromUserId !== peerId) return;
      setPeerTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setPeerTyping(false), 2500);
    });
    return () => {
      off();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [peerId]);

  // Keep the view pinned to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, peerTyping]);

  const onType = (value: string) => {
    setText(value);
    const now = Date.now();
    if (now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      sendSocket({ type: "typing", toUserId: peerId });
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (body && !sendMutation.isPending) sendMutation.mutate(body);
  };

  return (
    <div className="flex h-full flex-col rounded-card border border-border bg-surface/40">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link
          href="/messages"
          aria-label={t("nav_messages")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface hover:text-text lg:hidden"
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </Link>
        {peer && (
          <Link href={`/u/${peer.id}`} className="flex min-w-0 items-center gap-3">
            <Avatar name={peer.displayName} src={peer.avatarUrl} id={peer.id} size={40} />
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate font-medium text-text">
                {peer.displayName}
                {peer.isVerifiedArtist && <BadgeCheck className="h-4 w-4 text-accent-2" />}
              </p>
              {peerTyping && <p className="text-xs text-play">{t("msgTyping")}</p>}
            </div>
          </Link>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading ? (
          <LoadingBlock />
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-text-muted">
            <p>{t("msgStart")}</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
                  m.mine
                    ? "bg-gradient-brand text-white ltr:rounded-br-sm rtl:rounded-bl-sm"
                    : "bg-surface text-text ltr:rounded-bl-sm rtl:rounded-br-sm",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    m.mine ? "text-white/70" : "text-text-faint",
                  )}
                >
                  {timeLabel(m.createdAt, locale)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      {canMessage ? (
        <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
          <input
            value={text}
            onChange={(e) => onType(e.target.value)}
            placeholder={t("msgComposerPlaceholder")}
            aria-label={t("msgComposerPlaceholder")}
            className="flex-1 rounded-full border border-border bg-bg-elevated px-4 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <button
            type="submit"
            disabled={!text.trim() || sendMutation.isPending}
            aria-label={t("msgSend")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-brand text-white transition-transform hover:scale-105 disabled:opacity-40 cursor-pointer"
          >
            <Send className="h-5 w-5 rtl:rotate-180" />
          </button>
        </form>
      ) : (
        <p className="border-t border-border p-4 text-center text-sm text-text-muted">
          {t("msgDisabled")}
        </p>
      )}

      {sendMutation.isError && (
        <p className="px-4 pb-3 text-center text-xs text-danger">
          {sendMutation.error instanceof GraphQLError
            ? sendMutation.error.message
            : t("msgDisabled")}
        </p>
      )}
    </div>
  );
}
