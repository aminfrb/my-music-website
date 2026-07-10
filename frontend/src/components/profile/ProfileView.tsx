"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, MessageCircle, Pencil } from "lucide-react";
import { gql } from "@/lib/graphql";
import {
  FOLLOW_USER,
  SET_ALLOW_MESSAGES,
  UNFOLLOW_USER,
  UPDATE_PROFILE,
  USER_PROFILE,
} from "@/lib/queries";
import type { Connection, Music, User } from "@/lib/types";
import { formatCount, formatRelativeDate } from "@/lib/format";
import { useLocale } from "@/providers/LocaleProvider";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { MusicGrid, SectionHeader } from "@/components/music/MusicRail";
import { EmptyState, LoadingBlock, ErrorBlock } from "@/components/ui/States";

interface ProfileData extends User {
  music: Connection<Music>;
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-heading text-xl text-text">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

export function ProfileView({ userId }: { userId: string }) {
  const { t, locale } = useLocale();
  const { user: me, refreshMe } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => gql<{ user: ProfileData | null }>(USER_PROFILE, { id: userId }),
  });

  const followMutation = useMutation({
    mutationFn: (follow: boolean) =>
      gql(follow ? FOLLOW_USER : UNFOLLOW_USER, { userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["userProfile", userId] }),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !data?.user) return <ErrorBlock onRetry={() => refetch()} />;

  const user = data.user;
  const isMe = me?.id === user.id;
  const tracks = user.music.nodes;

  return (
    <div className="space-y-8">
      <section className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-end sm:text-start">
        <Avatar
          name={user.displayName}
          src={user.avatarUrl}
          id={user.id}
          size={128}
          className="shadow-glow"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <h1 className="font-heading text-3xl tracking-wide text-text">{user.displayName}</h1>
            {user.isVerifiedArtist && <BadgeCheck className="h-6 w-6 text-accent-2" />}
          </div>
          {user.bio && <p className="mt-2 text-text-muted">{user.bio}</p>}
          <p className="mt-1 text-sm text-text-faint">
            {t("memberSince")} {formatRelativeDate(user.joinDate, locale)}
          </p>

          <div className="mt-4 flex items-center justify-center gap-6 sm:justify-start">
            <StatPill value={formatCount(user.followerCount, locale)} label={t("followers")} />
            <StatPill value={formatCount(user.followingCount, locale)} label={t("following")} />
            <StatPill value={formatCount(user.trackCount, locale)} label={t("tracks")} />
            <StatPill value={formatCount(user.totalPlayCount, locale)} label={t("plays")} />
          </div>
        </div>

        <div>
          {isMe ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              {t("editProfile")}
            </Button>
          ) : me ? (
            <div className="flex items-center gap-2">
              <Button
                variant={user.isFollowedByMe ? "outline" : "primary"}
                loading={followMutation.isPending}
                onClick={() => followMutation.mutate(!user.isFollowedByMe)}
              >
                {user.isFollowedByMe ? t("unfollow") : t("follow")}
              </Button>
              {user.allowMessages !== false && (
                <Link href={`/messages/${user.id}`}>
                  <Button variant="outline">
                    <MessageCircle className="h-4 w-4" />
                    {t("msgButton")}
                  </Button>
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <SectionHeader title={t("nav_yourMusic")} />
        {tracks.length === 0 ? (
          <EmptyState title={t("noTracksYet")} />
        ) : (
          <MusicGrid tracks={tracks} />
        )}
      </section>

      {editing && (
        <EditProfileModal
          user={user}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await refetch();
            await refreshMe();
          }}
        />
      )}
    </div>
  );
}

function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? "");
  const [allowMessages, setAllowMessages] = useState(user.allowMessages !== false);

  const mutation = useMutation({
    mutationFn: async () => {
      await gql(UPDATE_PROFILE, { input: { displayName, bio } });
      if (allowMessages !== (user.allowMessages !== false)) {
        await gql(SET_ALLOW_MESSAGES, { allow: allowMessages });
      }
    },
    onSuccess: onSaved,
  });

  return (
    <Modal open onClose={onClose} title={t("editProfile")}>
      <div className="space-y-4">
        <Field label={t("displayName")}>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label={t("bio")}>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} />
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-3">
          <span className="text-sm text-text">{t("msgAllowLabel")}</span>
          <input
            type="checkbox"
            checked={allowMessages}
            onChange={(e) => setAllowMessages(e.target.checked)}
            className="h-5 w-5 accent-primary"
          />
        </label>
        <Button
          className="w-full"
          loading={mutation.isPending}
          disabled={!displayName.trim()}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t("saving") : t("saveChanges")}
        </Button>
      </div>
    </Modal>
  );
}
