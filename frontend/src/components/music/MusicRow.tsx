"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCount, formatDuration } from "@/lib/format";
import { Cover } from "@/components/ui/Cover";
import { usePlayer } from "@/providers/PlayerProvider";
import { useLocale } from "@/providers/LocaleProvider";
import type { Music } from "@/lib/types";

export function MusicRow({
  music,
  queue,
  index,
  trailing,
}: {
  music: Music;
  queue?: Music[];
  index?: number;
  trailing?: React.ReactNode;
}) {
  const { playTrack, isCurrent, isPlaying, toggle } = usePlayer();
  const { t, locale } = useLocale();
  const active = isCurrent(music.id);

  const onPlay = () => {
    if (active) toggle();
    else playTrack(music, queue);
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface",
        active && "bg-surface",
      )}
    >
      <div className="relative h-12 w-12 shrink-0">
        <Cover src={music.coverUrl} id={music.id} alt={music.title} rounded="rounded-lg" />
        <button
          type="button"
          onClick={onPlay}
          aria-label={active && isPlaying ? t("pause") : t("play")}
          className="absolute inset-0 grid place-items-center rounded-lg bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        >
          {active && isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={`/music/${music.id}`}
          className={cn(
            "block truncate font-medium hover:underline",
            active ? "text-primary" : "text-text",
          )}
        >
          {music.title}
        </Link>
        <Link
          href={`/u/${music.uploader.id}`}
          className="block truncate text-sm text-text-muted hover:text-text"
        >
          {music.artistName}
        </Link>
      </div>

      <span className="hidden text-xs text-text-faint sm:block">
        {formatCount(music.playCount, locale)} {t("plays")}
      </span>
      <span className="w-12 text-end text-xs text-text-faint tabular-nums">
        {formatDuration(music.duration)}
      </span>
      {trailing}
    </div>
  );
}
