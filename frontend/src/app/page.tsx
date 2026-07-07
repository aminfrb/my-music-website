"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Play, Upload } from "lucide-react";
import { gql } from "@/lib/graphql";
import { HOME_SECTIONS, LATEST_MUSIC } from "@/lib/queries";
import type { Connection, Genre, Music, Playlist } from "@/lib/types";
import { useLocale } from "@/providers/LocaleProvider";
import { useAuth } from "@/providers/AuthProvider";
import { usePlayer } from "@/providers/PlayerProvider";
import { Button } from "@/components/ui/Button";
import { LoadingBlock, SkeletonRail } from "@/components/ui/States";
import { MusicRail, SectionHeader, MusicGrid } from "@/components/music/MusicRail";
import { PlaylistCard } from "@/components/music/PlaylistCard";

interface HomeData {
  trendingMusic: Music[];
  todayPopularMusic: Music[];
  weekMostReactedMusic: Music[];
  lessDiscoveredMusic: Music[];
  popularPlaylists: Playlist[];
  genres: Genre[];
}

function Hero() {
  const { t } = useLocale();
  const { user } = useAuth();
  return (
    <section className="relative overflow-hidden rounded-card border border-border bg-gradient-to-br from-surface via-bg-elevated to-bg p-8 sm:p-12">
      <div className="absolute -top-24 h-64 w-64 rounded-full bg-primary/25 blur-3xl ltr:right-0 rtl:left-0" />
      <div className="absolute -bottom-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl ltr:left-10 rtl:right-10" />
      <div className="relative max-w-2xl">
        <p className="mb-3 inline-block rounded-full border border-border bg-bg/40 px-3 py-1 text-xs text-text-muted">
          {t("tagline")}
        </p>
        <h1 className="font-heading text-4xl leading-tight tracking-wide text-text sm:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mt-4 text-base text-text-muted sm:text-lg">{t("heroSubtitle")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={user ? "/for-you" : "/register"}>
            <Button size="lg">
              <Play className="h-5 w-5 fill-current" />
              {t("startListening")}
            </Button>
          </Link>
          <Link href={user ? "/upload" : "/login"}>
            <Button size="lg" variant="outline">
              <Upload className="h-5 w-5" />
              {t("uploadYourMusic")}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function GenreChips({ genres }: { genres: Genre[] }) {
  const { t } = useLocale();
  if (!genres?.length) return null;
  return (
    <section>
      <SectionHeader title={t("sec_genres")} />
      <div className="flex flex-wrap gap-3">
        {genres.map((g) => (
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
  );
}

function LatestGrid() {
  const { t } = useLocale();
  const sentinel = useRef<HTMLDivElement | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["latestMusic"],
      queryFn: ({ pageParam }) =>
        gql<{ latestMusic: Connection<Music> }>(LATEST_MUSIC, {
          first: 18,
          after: pageParam,
        }),
      initialPageParam: null as string | null,
      getNextPageParam: (last) =>
        last.latestMusic.pageInfo.hasNextPage
          ? last.latestMusic.pageInfo.endCursor
          : undefined,
    });

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const tracks = data?.pages.flatMap((p) => p.latestMusic.nodes) ?? [];

  return (
    <section>
      <SectionHeader title={t("sec_latest")} />
      {isLoading ? (
        <SkeletonRail count={6} />
      ) : (
        <MusicGrid tracks={tracks} />
      )}
      <div ref={sentinel} className="h-10" />
      {isFetchingNextPage && (
        <p className="py-4 text-center text-sm text-text-muted">{t("loading")}</p>
      )}
    </section>
  );
}

export default function HomePage() {
  const { t } = useLocale();
  const { data, isLoading } = useQuery({
    queryKey: ["homeSections"],
    queryFn: () => gql<HomeData>(HOME_SECTIONS),
  });

  return (
    <div className="space-y-12">
      <Hero />

      {isLoading && !data ? (
        <LoadingBlock />
      ) : (
        <>
          <MusicRail title={t("sec_trending")} tracks={data?.trendingMusic ?? []} />
          <LatestGrid />
          <MusicRail
            title={t("sec_todayPopular")}
            tracks={data?.todayPopularMusic ?? []}
          />
          <MusicRail
            title={t("sec_weekReacted")}
            tracks={data?.weekMostReactedMusic ?? []}
          />

          {(data?.popularPlaylists?.length ?? 0) > 0 && (
            <section>
              <SectionHeader title={t("sec_popularPlaylists")} />
              <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
                {data!.popularPlaylists.map((p) => (
                  <div key={p.id} className="w-44 shrink-0 sm:w-48">
                    <PlaylistCard playlist={p} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <MusicRail
            title={t("sec_lessDiscovered")}
            tracks={data?.lessDiscoveredMusic ?? []}
          />
          <GenreChips genres={data?.genres ?? []} />
        </>
      )}
    </div>
  );
}
