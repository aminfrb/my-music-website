"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Music2,
  Clock,
  Flag,
  PlayCircle,
  Activity,
  Check,
  X,
  Ban,
} from "lucide-react";
import { gql } from "@/lib/graphql";
import { ADMIN_OVERVIEW, ADMIN_QUEUE, ADMIN_REVIEW_MUSIC } from "@/lib/queries";
import type { AdminOverview, Connection, Music } from "@/lib/types";
import { formatCount } from "@/lib/format";
import { useLocale } from "@/providers/LocaleProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Cover } from "@/components/ui/Cover";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingBlock } from "@/components/ui/States";
import type { Dict } from "@/i18n/dictionaries";

function OverviewCards() {
  const { t, locale } = useLocale();
  const { data } = useQuery({
    queryKey: ["adminOverview"],
    queryFn: () => gql<{ adminOverview: AdminOverview }>(ADMIN_OVERVIEW),
  });
  const o = data?.adminOverview;

  const cards: Array<{ icon: typeof Users; label: keyof Dict; value: number }> = [
    { icon: Users, label: "totalUsers", value: o?.totalUsers ?? 0 },
    { icon: Music2, label: "totalMusic", value: o?.totalMusic ?? 0 },
    { icon: Clock, label: "pendingMusic", value: o?.pendingMusic ?? 0 },
    { icon: Flag, label: "openReports", value: o?.openReports ?? 0 },
    { icon: PlayCircle, label: "totalPlays", value: o?.totalPlays ?? 0 },
    { icon: Activity, label: "activeUsers", value: o?.activeUsers24h ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map(({ icon: Icon, label, value }) => (
        <div key={label} className="rounded-card border border-border bg-surface/40 p-4">
          <Icon className="h-5 w-5 text-primary" />
          <p className="mt-3 font-heading text-2xl text-text">{formatCount(value, locale)}</p>
          <p className="text-xs text-text-muted">{t(label)}</p>
        </div>
      ))}
    </div>
  );
}

function ModerationQueue() {
  const { t } = useLocale();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["adminQueue"],
    queryFn: () =>
      gql<{ adminMusicQueue: Connection<Music> }>(ADMIN_QUEUE, { status: "pending" }),
  });

  const review = useMutation({
    mutationFn: (vars: { musicId: string; action: "approve" | "reject" | "block" }) =>
      gql(ADMIN_REVIEW_MUSIC, vars),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["adminQueue"] });
      void queryClient.invalidateQueries({ queryKey: ["adminOverview"] });
    },
  });

  const items = data?.adminMusicQueue.nodes ?? [];

  if (isLoading) return <LoadingBlock />;
  if (items.length === 0) return <EmptyState title={t("queueEmpty")} />;

  return (
    <div className="space-y-3">
      {items.map((m) => (
        <div
          key={m.id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface/40 p-3 sm:flex-row sm:items-center"
        >
          <div className="h-14 w-14 shrink-0">
            <Cover src={m.coverUrl} id={m.id} alt={m.title} rounded="rounded-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-text">{m.title}</p>
            <p className="truncate text-sm text-text-muted">
              {m.artistName} · {m.genre.name} · {m.uploader.displayName}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="play"
              loading={review.isPending && review.variables?.musicId === m.id}
              onClick={() => review.mutate({ musicId: m.id, action: "approve" })}
            >
              <Check className="h-4 w-4" />
              {t("approve")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => review.mutate({ musicId: m.id, action: "reject" })}
            >
              <X className="h-4 w-4" />
              {t("reject")}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => review.mutate({ musicId: m.id, action: "block" })}
            >
              <Ban className="h-4 w-4" />
              {t("block")}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminContent() {
  const { t } = useLocale();
  return (
    <div className="space-y-10">
      <h1 className="font-heading text-4xl tracking-wide text-text">{t("adminDashboard")}</h1>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl tracking-wide text-text">{t("overview")}</h2>
        <OverviewCards />
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl tracking-wide text-text">{t("moderationQueue")}</h2>
        <ModerationQueue />
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth admin>
      <AdminContent />
    </RequireAuth>
  );
}
