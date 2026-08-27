"use client";

import Link from "next/link";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { Cover } from "@/components/ui/Cover";
import { usePlayer } from "@/providers/PlayerProvider";
import { useLocale } from "@/providers/LocaleProvider";

/**
 * The filled part of a slider, as a percentage the stylesheet can paint from
 * whichever edge the current direction starts at. It has to be a custom
 * property rather than an inline gradient: an inline `linear-gradient(to right,
 * …)` is physical, so in Persian it fills from the left while the native thumb
 * travels right-to-left, and the two disagree.
 */
function rangeFill(percent: number): React.CSSProperties {
  const clamped = Math.min(100, Math.max(0, percent));
  return { "--range-fill": `${Number(clamped.toFixed(2))}%` } as React.CSSProperties;
}

export function PlayerBar() {
  const {
    current,
    isPlaying,
    currentTime,
    duration,
    volume,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    close,
    index,
    queue,
  } = usePlayer();
  const { t } = useLocale();

  if (!current) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 z-30 border-t border-border bg-bg-elevated/95 backdrop-blur-xl ltr:left-0 ltr:right-0 rtl:left-0 rtl:right-0 lg:ltr:pl-64 lg:rtl:pr-64">
      {/* Seek bar spanning the top edge */}
      <div className="px-4 pt-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="w-10 text-end text-[11px] tabular-nums text-text-faint">
            {formatDuration(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label={t("seek")}
            className="flex-1"
            style={rangeFill(progress)}
          />
          <span className="w-10 text-[11px] tabular-nums text-text-faint">
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        {/* Track info */}
        <Link href={`/music/${current.id}`} className="flex min-w-0 items-center gap-3">
          <div className="h-12 w-12 shrink-0">
            <Cover
              src={current.coverUrl}
              id={current.id}
              alt={current.title}
              rounded="rounded-lg"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">{current.title}</p>
            <p className="truncate text-xs text-text-muted">{current.artistName}</p>
          </div>
        </Link>

        {/* Transport */}
        <div className="ltr:ml-auto rtl:mr-auto flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={index <= 0}
            aria-label={t("previous")}
            className="grid h-10 w-10 place-items-center rounded-full text-text-muted transition-colors hover:text-text disabled:opacity-40 cursor-pointer"
          >
            <SkipBack className="h-5 w-5 fill-current rtl:-scale-x-100" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? t("pause") : t("play")}
            className="grid h-11 w-11 place-items-center rounded-full bg-text text-bg transition-transform hover:scale-105 cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={next}
            disabled={index >= queue.length - 1}
            aria-label={t("next")}
            className="grid h-10 w-10 place-items-center rounded-full text-text-muted transition-colors hover:text-text disabled:opacity-40 cursor-pointer"
          >
            <SkipForward className="h-5 w-5 fill-current rtl:-scale-x-100" />
          </button>
        </div>

        {/* Volume (desktop) */}
        <div className="ltr:ml-4 rtl:mr-4 hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => setVolume(volume > 0 ? 0 : 1)}
            aria-label={volume > 0 ? t("mute") : t("unmute")}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full text-text-muted hover:text-text cursor-pointer",
            )}
          >
            {volume > 0 ? (
              <Volume2 className="h-5 w-5 rtl:-scale-x-100" />
            ) : (
              <VolumeX className="h-5 w-5 rtl:-scale-x-100" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label={t("volume")}
            className="w-24"
            style={rangeFill(volume * 100)}
          />
        </div>

        {/* Close — stops playback and dismisses the bar */}
        <button
          type="button"
          onClick={close}
          aria-label={t("closePlayer")}
          title={t("closePlayer")}
          className="ltr:ml-1 rtl:mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-text cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
