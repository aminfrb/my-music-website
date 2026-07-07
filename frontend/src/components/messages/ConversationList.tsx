"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { gql } from "@/lib/graphql";
import { CONVERSATIONS } from "@/lib/queries";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatRelativeDate } from "@/lib/format";
import { useLocale } from "@/providers/LocaleProvider";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, LoadingBlock } from "@/components/ui/States";

export function ConversationList({ activeUserId }: { activeUserId?: string }) {
  const { t, locale } = useLocale();
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => gql<{ conversations: Conversation[] }>(CONVERSATIONS),
    refetchInterval: 30_000,
  });

  const conversations = data?.conversations ?? [];

  return (
    <div className="flex h-full flex-col rounded-card border border-border bg-surface/40">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-heading text-lg tracking-wide text-text">{t("nav_messages")}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <LoadingBlock />
        ) : conversations.length === 0 ? (
          <EmptyState icon={<MessageCircle className="h-9 w-9" />} title={t("msgEmptyList")} />
        ) : (
          <ul className="space-y-1">
            {conversations.map((c) => {
              const active = c.otherUser.id === activeUserId;
              return (
                <li key={c.id}>
                  <Link
                    href={`/messages/${c.otherUser.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                      active ? "bg-surface" : "hover:bg-surface/60",
                    )}
                  >
                    <Avatar
                      name={c.otherUser.displayName}
                      src={c.otherUser.avatarUrl}
                      id={c.otherUser.id}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium text-text">{c.otherUser.displayName}</p>
                        <span className="shrink-0 text-[11px] text-text-faint">
                          {formatRelativeDate(c.lastMessageAt, locale)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-sm",
                            c.unreadCount > 0 ? "text-text" : "text-text-muted",
                          )}
                        >
                          {c.lastMessage}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                            {c.unreadCount > 9 ? "9+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
