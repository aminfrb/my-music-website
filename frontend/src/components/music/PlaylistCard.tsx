"use client";

import Link from "next/link";
import { ListMusic } from "lucide-react";
import { Cover } from "@/components/ui/Cover";
import { formatCount } from "@/lib/format";
import { useLocale } from "@/providers/LocaleProvider";
import type { Playlist } from "@/lib/types";

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const { t, locale } = useLocale();
  return (
    <Link
      href={`/playlist/${playlist.id}`}
      className="group block w-full rounded-card border border-transparent bg-surface/60 p-3 transition-all duration-200 hover:border-border hover:bg-surface"
    >
      <div className="relative">
        <Cover src={playlist.coverUrl} id={playlist.id} alt={playlist.name} />
        <span className="absolute bottom-2 grid h-8 items-center rounded-full bg-black/60 px-2.5 text-xs text-white ltr:right-2 rtl:left-2">
          <span className="flex items-center gap-1">
            <ListMusic className="h-3.5 w-3.5" />
            {formatCount(playlist.trackCount, locale)}
          </span>
        </span>
      </div>
      <p className="mt-3 truncate font-semibold text-text group-hover:text-primary">
        {playlist.name}
      </p>
      <p className="truncate text-sm text-text-muted">
        {playlist.owner.displayName} · {formatCount(playlist.followersCount, locale)}{" "}
        {t("followers")}
      </p>
    </Link>
  );
}
