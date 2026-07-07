"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Heart, Trash2, ListMusic } from "lucide-react";
import { gql } from "@/lib/graphql";
import {
  FOLLOW_PLAYLIST,
  PLAYLIST_DETAIL,
  REMOVE_FROM_PLAYLIST,
  UNFOLLOW_PLAYLIST,
} from "@/lib/queries";
import type { Music, Playlist, PlaylistItem } from "@/lib/types";
import { formatCount } from "@/lib/format";
import { useLocale } from "@/providers/LocaleProvider";
import { useAuth } from "@/providers/AuthProvider";
import { usePlayer } from "@/providers/PlayerProvider";
import { Cover } from "@/components/ui/Cover";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/States";
import { MusicRow } from "@/components/music/MusicRow";
import { cn } from "@/lib/cn";

interface PlaylistDetail extends Playlist {
  items: PlaylistItem[];
}

export default function PlaylistPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const { playQueue } = usePlayer();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["playlist", id],
    queryFn: () => gql<{ playlist: PlaylistDetail | null }>(PLAYLIST_DETAIL, { id }),
  });

  const followMutation = useMutation({
    mutationFn: (follow: boolean) =>
      gql(follow ? FOLLOW_PLAYLIST : UNFOLLOW_PLAYLIST, { playlistId: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlist", id] }),
  });

  const removeMutation = useMutation({
    mutationFn: (musicId: string) =>
      gql(REMOVE_FROM_PLAYLIST, { playlistId: id, musicId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlist", id] }),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !data?.playlist) return <ErrorBlock onRetry={() => refetch()} />;

  const playlist = data.playlist;
  const tracks: Music[] = playlist.items.map((i) => i.music);
  const isOwner = user?.id === playlist.owner.id;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="w-full max-w-[220px] shrink-0 self-center sm:self-auto">
          <div className="overflow-hidden rounded-card shadow-card">
            <Cover
              src={playlist.coverUrl}
              id={playlist.id}
              alt={playlist.name}
              rounded="rounded-card"
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-muted">{t("cat_playlists")}</p>
          <h1 className="mt-1 font-heading text-4xl tracking-wide text-text sm:text-5xl">
            {playlist.name}
          </h1>
          {playlist.description && (
            <p className="mt-2 text-text-muted">{playlist.description}</p>
          )}
          <Link
            href={`/u/${playlist.owner.id}`}
            className="mt-3 inline-flex items-center gap-2 text-text-muted hover:text-text"
          >
            <Avatar
              name={playlist.owner.displayName}
              src={playlist.owner.avatarUrl}
              id={playlist.owner.id}
              size={24}
            />
            <span className="font-medium">{playlist.owner.displayName}</span>
          </Link>
          <p className="mt-1 text-sm text-text-faint">
            {formatCount(playlist.trackCount, locale)} {t("tracks")} ·{" "}
            {formatCount(playlist.followersCount, locale)} {t("followers")}
          </p>

          <div className="mt-5 flex items-center gap-3">
            <Button
              size="lg"
              variant="play"
              disabled={!tracks.length}
              onClick={() => playQueue(tracks, 0)}
            >
              <Play className="h-5 w-5 fill-current" />
              {t("play")}
            </Button>
            {user && !isOwner && (
              <Button
                size="lg"
                variant={playlist.isFollowedByMe ? "outline" : "primary"}
                loading={followMutation.isPending}
                onClick={() => followMutation.mutate(!playlist.isFollowedByMe)}
              >
                <Heart
                  className={cn("h-5 w-5", playlist.isFollowedByMe && "fill-current text-accent")}
                />
                {playlist.isFollowedByMe ? t("unfollow") : t("follow")}
              </Button>
            )}
          </div>
        </div>
      </section>

      {tracks.length === 0 ? (
        <EmptyState icon={<ListMusic className="h-10 w-10" />} title={t("emptyPlaylist")} />
      ) : (
        <div className="space-y-1">
          {playlist.items.map((item) => (
            <MusicRow
              key={item.id}
              music={item.music}
              queue={tracks}
              trailing={
                isOwner ? (
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(item.music.id)}
                    aria-label={t("removeFromPlaylist")}
                    className="grid h-9 w-9 place-items-center rounded-full text-text-faint transition-colors hover:bg-danger/15 hover:text-danger cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
