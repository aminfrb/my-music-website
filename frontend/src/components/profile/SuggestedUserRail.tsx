"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Sparkles } from "lucide-react";
import { gql } from "@/lib/graphql";
import { FOLLOW_USER, UNFOLLOW_USER } from "@/lib/queries";
import type { SuggestedUser } from "@/lib/types";
import { formatCount } from "@/lib/format";
import { useLocale } from "@/providers/LocaleProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/music/MusicRail";

/**
 * One person the ranker thinks is worth following, with the reason it thinks so.
 * Following from here is the fastest way for a new account to bootstrap its
 * recommendations, so the button stays on the card rather than behind a profile visit.
 */
function SuggestedUserCard({ suggestion }: { suggestion: SuggestedUser }) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const { user } = suggestion;

  const followMutation = useMutation({
    mutationFn: (follow: boolean) =>
      gql(follow ? FOLLOW_USER : UNFOLLOW_USER, { userId: user.id }),
    onSuccess: () => {
      // Following changes what the ranker returns, so refresh the whole page.
      queryClient.invalidateQueries({ queryKey: ["recommendationSections"] });
      queryClient.invalidateQueries({ queryKey: ["followingFeed"] });
    },
  });

  return (
    <div className="flex w-52 shrink-0 flex-col items-center gap-2 rounded-card border border-border bg-surface/40 p-4 text-center transition-colors hover:border-primary/40">
      <Link href={`/u/${user.id}`} className="flex flex-col items-center gap-2">
        <Avatar name={user.displayName} src={user.avatarUrl} id={user.id} size={64} />
        <span className="flex items-center gap-1 font-medium text-text">
          <span className="line-clamp-1">{user.displayName}</span>
          {user.isVerifiedArtist && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
        </span>
      </Link>

      <p className="line-clamp-2 text-xs text-text-faint">{suggestion.reason}</p>

      {suggestion.sharedGenres.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1">
          {suggestion.sharedGenres.slice(0, 2).map((g) => (
            <span key={g.id} className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-text-muted">
              {g.name}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-text-faint">
        {formatCount(user.followerCount)} {t("followersCount")} · {formatCount(user.trackCount)}{" "}
        {t("tracksCount")}
      </p>

      <Button
        size="sm"
        className="mt-1 w-full"
        variant={user.isFollowedByMe ? "outline" : "primary"}
        loading={followMutation.isPending}
        onClick={() => followMutation.mutate(!user.isFollowedByMe)}
      >
        {user.isFollowedByMe ? t("following_") : t("follow")}
      </Button>
    </div>
  );
}

export function SuggestedUserRail({ suggestions }: { suggestions: SuggestedUser[] }) {
  const { t } = useLocale();
  if (!suggestions?.length) return null;
  return (
    <section className="animate-fade-up">
      <SectionHeader title={t("sec_suggestedUsers")} />
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {suggestions.map((s) => (
          <SuggestedUserCard key={s.user.id} suggestion={s} />
        ))}
      </div>
    </section>
  );
}

/** Small inline badge explaining why a track was recommended. */
export function ReasonBadge({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-text-faint">
      <Sparkles className="h-3 w-3 text-primary" />
      <span className="line-clamp-1">{reason}</span>
    </span>
  );
}
