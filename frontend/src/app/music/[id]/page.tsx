"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Pause, Play } from "lucide-react";
import { gql } from "@/lib/graphql";
import { MUSIC_DETAIL } from "@/lib/queries";
import type { Music } from "@/lib/types";
import { formatCount, formatDuration, formatRelativeDate } from "@/lib/format";
import { useLocale } from "@/providers/LocaleProvider";
import { usePlayer } from "@/providers/PlayerProvider";
import { Cover } from "@/components/ui/Cover";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingBlock, ErrorBlock } from "@/components/ui/States";
import { ReactionBar } from "@/components/music/ReactionBar";
import { TrackActions } from "@/components/music/TrackActions";
import { MusicRail } from "@/components/music/MusicRail";
import { REACTIONS } from "@/i18n/dictionaries";

interface MusicDetail extends Music {
  similar: Music[];
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 px-4 py-3 text-center">
      <p className="font-heading text-xl text-text">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

export default function MusicPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { t, locale } = useLocale();
  const { playTrack, toggle, isCurrent, isPlaying } = usePlayer();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["music", id],
    queryFn: () => gql<{ music: MusicDetail | null }>(MUSIC_DETAIL, { id }),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !data?.music) return <ErrorBlock onRetry={() => refetch()} />;

  const music = data.music;
  const active = isCurrent(music.id);
  const topReaction = [...music.reactionBreakdown].sort((a, b) => b.count - a.count)[0];
  const topEmoji = REACTIONS.find((r) => r.type === topReaction?.type)?.emoji;

  return (
    <div className="space-y-12">
      <section className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="w-full max-w-[260px] shrink-0 self-center sm:self-auto">
          <div className="overflow-hidden rounded-card shadow-card">
            <Cover src={music.coverUrl} id={music.id} alt={music.title} rounded="rounded-card" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={`/genre/${music.genre.slug}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {music.genre.name}
          </Link>
          <h1 className="mt-1 font-heading text-4xl leading-tight tracking-wide text-text sm:text-5xl">
            {music.title}
          </h1>

          <Link
            href={`/u/${music.uploader.id}`}
            className="mt-3 inline-flex items-center gap-2 text-text-muted hover:text-text"
          >
            <Avatar
              name={music.uploader.displayName}
              src={music.uploader.avatarUrl}
              id={music.uploader.id}
              size={28}
            />
            <span className="font-medium">{music.artistName}</span>
            {music.uploader.isVerifiedArtist && (
              <BadgeCheck className="h-4 w-4 text-accent-2" />
            )}
          </Link>

          <p className="mt-2 text-sm text-text-faint">
            {music.publishedAt ? formatRelativeDate(music.publishedAt, locale) : ""} ·{" "}
            {formatDuration(music.duration)}
          </p>

          <div className="mt-5 flex items-center gap-3">
            <Button
              size="lg"
              variant="play"
              onClick={() => (active ? toggle() : playTrack(music))}
            >
              {active && isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
              {active && isPlaying ? t("pause") : t("play")}
            </Button>
            <TrackActions music={music} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={formatCount(music.playCount, locale)} label={t("plays")} />
        <Stat value={formatCount(music.saveCount, locale)} label={t("saves")} />
        <Stat value={formatCount(music.reactionCount, locale)} label={t("reactions")} />
        <Stat
          value={topEmoji ? `${topEmoji}` : "—"}
          label={t("react")}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl tracking-wide text-text">{t("react")}</h2>
        <ReactionBar music={music} />
      </section>

      {music.description && (
        <section className="max-w-3xl">
          <p className="whitespace-pre-wrap leading-relaxed text-text-muted">
            {music.description}
          </p>
        </section>
      )}

      {music.tags.length > 0 && (
        <section className="flex flex-wrap gap-2">
          {music.tags.map((tag) => (
            <Link
              key={tag}
              href={`/search?q=${encodeURIComponent(tag)}`}
              className="rounded-full bg-surface px-3 py-1.5 text-sm text-text-muted transition-colors hover:text-text"
            >
              #{tag}
            </Link>
          ))}
        </section>
      )}

      <MusicRail title={t("similarTracks")} tracks={music.similar ?? []} />
    </div>
  );
}
