"use client";

import { useQuery } from "@tanstack/react-query";
import { gql } from "@/lib/graphql";
import { GENRE_DETAIL, SEARCH } from "@/lib/queries";
import type { Genre, SearchResult } from "@/lib/types";
import { formatCount } from "@/lib/format";
import { useLocale } from "@/providers/LocaleProvider";
import { MusicGrid } from "@/components/music/MusicRail";
import { EmptyState, LoadingBlock, ErrorBlock } from "@/components/ui/States";

export default function GenrePage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { t, locale } = useLocale();

  const genreQuery = useQuery({
    queryKey: ["genre", slug],
    queryFn: () => gql<{ genre: Genre | null }>(GENRE_DETAIL, { slug }),
  });

  const genre = genreQuery.data?.genre;

  // The API has no genre→tracks listing; surface matching tracks via search.
  const tracksQuery = useQuery({
    queryKey: ["genreTracks", genre?.name],
    queryFn: () =>
      gql<{ search: SearchResult }>(SEARCH, { query: genre!.name, perCategory: 40 }),
    enabled: Boolean(genre?.name),
  });

  if (genreQuery.isLoading) return <LoadingBlock />;
  if (genreQuery.isError || !genre) return <ErrorBlock onRetry={() => genreQuery.refetch()} />;

  const tracks = tracksQuery.data?.search.music ?? [];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-card border border-border bg-gradient-to-br from-primary/25 via-surface to-bg p-8 sm:p-12">
        <p className="text-sm font-medium text-text-muted">{t("sec_genres")}</p>
        <h1 className="mt-1 font-heading text-5xl tracking-wide text-text">{genre.name}</h1>
        <p className="mt-2 text-text-muted">
          {formatCount(genre.trackCount, locale)} {t("tracks")}
        </p>
      </section>

      {tracksQuery.isLoading ? (
        <LoadingBlock />
      ) : tracks.length === 0 ? (
        <EmptyState title={t("noResults")} />
      ) : (
        <MusicGrid tracks={tracks} />
      )}
    </div>
  );
}
