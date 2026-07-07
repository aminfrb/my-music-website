"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { Cover } from "@/components/ui/Cover";
import { usePlayer } from "@/providers/PlayerProvider";
import { useLocale } from "@/providers/LocaleProvider";
import type { Music } from "@/lib/types";

export function MusicCard({
  music,
  queue,
  className,
}: {
  music: Music;
  queue?: Music[];
  className?: string;
}) {
  const { playTrack, isCurrent, isPlaying, toggle } = usePlayer();
  const { t, locale } = useLocale();
  const active = isCurrent(music.id);

  const onPlay = (e: React.MouseEvent) => {
    e.preventDefault();
    if (active) toggle();
    else playTrack(music, queue);
  };

  return (
    <div
      className={cn(
        "group relative w-full rounded-card border border-transparent bg-surface/60 p-3 transition-all duration-200 hover:border-border hover:bg-surface",
        active && "border-primary/40 bg-surface",
        className,
      )}
    >
      <Link href={`/music/${music.id}`} className="block">
        <div className="relative">
          <Cover src={music.coverUrl} id={music.id} alt={music.title} />
          <button
            type="button"
            onClick={onPlay}
            aria-label={active && isPlaying ? t("pause") : t("play")}
            className={cn(
              "absolute bottom-2 grid h-11 w-11 place-items-center rounded-full bg-play text-black shadow-glow transition-all duration-200 hover:scale-105",
              "ltr:right-2 rtl:left-2",
              active
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0",
            )}
          >
            {active && isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current ltr:ml-0.5" />
            )}
          </button>
        </div>
      </Link>
      <div className="mt-3 min-w-0">
        <Link
          href={`/music/${music.id}`}
          className={cn(
            "block truncate font-semibold hover:underline",
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
        <p className="mt-1 text-xs text-text-faint">
          {formatCount(music.playCount, locale)} {t("plays")}
        </p>
      </div>
    </div>
  );
}
