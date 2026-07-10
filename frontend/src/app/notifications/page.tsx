"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BadgeCheck,
  Heart,
  MessageSquare,
  UserPlus,
  XCircle,
  ListMusic,
} from "lucide-react";
import { gql } from "@/lib/graphql";
import { MARK_ALL_READ, NOTIFICATIONS } from "@/lib/queries";
import type { Connection, Notification, NotificationType } from "@/lib/types";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useLocale } from "@/providers/LocaleProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingBlock } from "@/components/ui/States";

const ICONS: Record<NotificationType, typeof Bell> = {
  music_published: BadgeCheck,
  music_rejected: XCircle,
  music_saved: ListMusic,
  music_reaction: Heart,
  new_follower: UserPlus,
  playlist_followed: MessageSquare,
};

function NotificationsContent() {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      gql<{ notifications: Connection<Notification>; unreadNotificationCount: number }>(
        NOTIFICATIONS,
        { first: 40 },
      ),
  });

  const markAll = useMutation({
    mutationFn: () => gql(MARK_ALL_READ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  // Mark all read on view (once loaded with unread items).
  useEffect(() => {
    if ((data?.unreadNotificationCount ?? 0) > 0 && !markAll.isPending) {
      markAll.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.unreadNotificationCount]);

  const items = data?.notifications.nodes ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl tracking-wide text-text">{t("notifications")}</h1>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>
            {t("markAllRead")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell className="h-10 w-10" />} title={t("noNotifications")} />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 transition-colors",
                  n.isRead
                    ? "border-border bg-surface/30"
                    : "border-primary/40 bg-primary/5",
                )}
              >
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text">{n.title}</p>
                  <p className="text-sm text-text-muted">{n.message}</p>
                  <p className="mt-1 text-xs text-text-faint">
                    {formatRelativeDate(n.createdAt, locale)}
                  </p>
                </div>
                {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  );
}
