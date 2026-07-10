"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { gql } from "@/lib/graphql";
import { SEARCH } from "@/lib/queries";
import type { SearchResult } from "@/lib/types";
import { useLocale } from "@/providers/LocaleProvider";
import { MusicGrid, SectionHeader } from "@/components/music/MusicRail";
import { PlaylistCard } from "@/components/music/PlaylistCard";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, LoadingBlock } from "@/components/ui/States";

function SearchContent() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [value, setValue] = useState(q);

  useEffect(() => setValue(q), [q]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["search", q],
    queryFn: () => gql<{ search: SearchResult }>(SEARCH, { query: q, perCategory: 12 }),
    enabled: q.trim().length > 0,
  });

  const res = data?.search;
  const empty =
    res &&
    !res.music.length &&
    !res.users.length &&
    !res.playlists.length &&
    !res.genres.length &&
    !res.tags.length;

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(value.trim())}`);
        }}
        className="relative"
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 text-text-faint ltr:left-4 rtl:right-4" />
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-full border border-border bg-surface/70 py-3.5 text-lg text-text placeholder:text-text-faint focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25 ltr:pl-12 ltr:pr-4 rtl:pr-12 rtl:pl-4"
        />
      </form>

      {!q.trim() ? (
        <EmptyState icon={<SearchIcon className="h-10 w-10" />} title={t("searchPrompt")} />
      ) : isLoading ? (
        <LoadingBlock />
      ) : isError ? (
        <EmptyState title={t("somethingWrong")} />
      ) : empty ? (
        <EmptyState title={`${t("noResults")} — “${q}”`} />
      ) : (
        <div className="space-y-8">
          {res!.genres.length > 0 && (
            <section>
              <SectionHeader title={t("cat_genres")} />
              <div className="flex flex-wrap gap-3">
                {res!.genres.map((g) => (
                  <Link
                    key={g.id}
                    href={`/genre/${g.slug}`}
                    className="rounded-full border border-border bg-surface/60 px-4 py-2 text-sm text-text-muted transition-all hover:border-primary/60 hover:text-text"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {res!.music.length > 0 && (
            <section>
              <SectionHeader title={t("cat_music")} />
              <MusicGrid tracks={res!.music} />
            </section>
          )}

          {res!.users.length > 0 && (
            <section>
              <SectionHeader title={t("cat_users")} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {res!.users.map((u) => (
                  <Link
                    key={u.id}
                    href={`/u/${u.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-3 transition-colors hover:bg-surface"
                  >
                    <Avatar name={u.displayName} src={u.avatarUrl} id={u.id} size={44} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text">{u.displayName}</p>
                      <p className="text-xs text-text-muted">
                        {u.followerCount} {t("followers")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {res!.playlists.length > 0 && (
            <section>
              <SectionHeader title={t("cat_playlists")} />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {res!.playlists.map((p) => (
                  <PlaylistCard key={p.id} playlist={p} />
                ))}
              </div>
            </section>
          )}

          {res!.tags.length > 0 && (
            <section>
              <SectionHeader title={t("cat_tags")} />
              <div className="flex flex-wrap gap-2">
                {res!.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full bg-surface px-3 py-1.5 text-sm text-text-muted"
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <SearchContent />
    </Suspense>
  );
}
