"use client";

import { useQuery } from "@tanstack/react-query";
import { gql } from "@/lib/graphql";
import { RECOMMENDATION_SECTIONS, FOLLOWING_FEED } from "@/lib/queries";
import type { Connection, Music, RecommendationSections } from "@/lib/types";
import { useLocale } from "@/providers/LocaleProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { MusicRail } from "@/components/music/MusicRail";
import { LoadingBlock, EmptyState } from "@/components/ui/States";
import { Sparkles } from "lucide-react";

function ForYouContent() {
  const { t } = useLocale();

  const recs = useQuery({
    queryKey: ["recommendationSections"],
    queryFn: () =>
      gql<{ recommendationSections: RecommendationSections }>(RECOMMENDATION_SECTIONS),
  });

  const feed = useQuery({
    queryKey: ["followingFeed"],
    queryFn: () =>
      gql<{ followingFeed: Connection<Music> }>(FOLLOWING_FEED, { first: 12 }),
  });

  if (recs.isLoading) return <LoadingBlock />;

  const s = recs.data?.recommendationSections;
  const feedTracks = feed.data?.followingFeed.nodes ?? [];
  const anything =
    s &&
    (s.forYou.length ||
      s.similarToSaved.length ||
      s.basedOnGenres.length ||
      s.popularAmongSimilar.length ||
      s.newReleases.length ||
      s.newDiscovery.length ||
      feedTracks.length);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl tracking-wide text-text">{t("nav_forYou")}</h1>
        <p className="mt-2 text-text-muted">{t("heroSubtitle")}</p>
      </div>

      {!anything ? (
        <EmptyState
          icon={<Sparkles className="h-10 w-10" />}
          title={t("noResults")}
        >
          {t("heroSubtitle")}
        </EmptyState>
      ) : (
        <>
          <MusicRail title={t("sec_forYou")} tracks={s?.forYou ?? []} />
          <MusicRail title={t("sec_followingFeed")} tracks={feedTracks} />
          <MusicRail title={t("sec_similarToSaved")} tracks={s?.similarToSaved ?? []} />
          <MusicRail title={t("sec_basedOnGenres")} tracks={s?.basedOnGenres ?? []} />
          <MusicRail
            title={t("sec_popularAmongSimilar")}
            tracks={s?.popularAmongSimilar ?? []}
          />
          <MusicRail title={t("sec_newReleases")} tracks={s?.newReleases ?? []} />
          <MusicRail title={t("sec_newDiscovery")} tracks={s?.newDiscovery ?? []} />
        </>
      )}
    </div>
  );
}

export default function ForYouPage() {
  return (
    <RequireAuth>
      <ForYouContent />
    </RequireAuth>
  );
}
