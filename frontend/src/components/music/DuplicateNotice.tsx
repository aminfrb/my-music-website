"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CircleAlert } from "lucide-react";
import { gql } from "@/lib/graphql";
import { FOLLOW_USER, UNFOLLOW_USER } from "@/lib/queries";
import type { DuplicateDetails } from "@/lib/types";
import { formatRelativeDate } from "@/lib/format";
import { useLocale } from "@/providers/LocaleProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";

/**
 * Shown when an upload is rejected because the song is already here.
 *
 * A bare "duplicate" error is a dead end, so this turns the rejection into an
 * introduction: who posted it first, a link to the track and to their profile,
 * and a follow button — the person uploading it clearly likes this music.
 */
export function DuplicateNotice({
  duplicate,
  message,
  onDismiss,
}: {
  duplicate: DuplicateDetails;
  message: string;
  onDismiss?: () => void;
}) {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const uploader = duplicate.uploader;

  const followMutation = useMutation({
    mutationFn: () => gql(FOLLOW_USER, { userId: uploader!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendationSections"] });
      queryClient.invalidateQueries({ queryKey: ["followingFeed"] });
    },
  });
  const followed = followMutation.isSuccess;

  return (
    <div className="mb-4 overflow-hidden rounded-card border border-warning/40 bg-warning/5">
      <div className="flex items-start gap-3 border-b border-warning/20 px-4 py-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="font-medium text-text">{t("dupTitle")}</p>
          <p className="mt-0.5 text-sm text-text-muted">{message}</p>
          <p className="mt-0.5 text-sm text-text-faint">
            {duplicate.kind === "file" ? t("dupSameFile") : t("dupSameSong")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {uploader ? (
          <>
            <Link href={`/u/${uploader.id}`} className="flex items-center gap-3">
              <Avatar
                name={uploader.displayName}
                src={uploader.avatarUrl}
                id={uploader.id}
                size={44}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-medium text-text">
                  <span className="line-clamp-1">{uploader.displayName}</span>
                  {uploader.isVerifiedArtist && (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </span>
                <span className="block text-xs text-text-faint">
                  {t("dupUploadedBy")} ·{" "}
                  {duplicate.publishedAt
                    ? formatRelativeDate(duplicate.publishedAt, locale)
                    : ""}
                </span>
              </span>
            </Link>

            <div className="flex flex-col items-end gap-1 ltr:ml-auto rtl:mr-auto">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={followed ? "outline" : "primary"}
                  loading={followMutation.isPending}
                  disabled={followed}
                  onClick={() => followMutation.mutate()}
                >
                  {followed ? t("following_") : t("follow")}
                </Button>
                <Link href={`/u/${uploader.id}`}>
                  <Button size="sm" variant="outline">
                    {t("viewProfile")}
                  </Button>
                </Link>
                <Link href={`/music/${duplicate.musicId}`}>
                  <Button size="sm" variant="ghost">
                    {t("dupOpenTrack")}
                  </Button>
                </Link>
              </div>
              <InlineError error={followMutation.error} />
            </div>
          </>
        ) : (
          <Link href={`/music/${duplicate.musicId}`}>
            <Button size="sm" variant="outline">
              {t("dupOpenTrack")}
            </Button>
          </Link>
        )}
      </div>

      {onDismiss && (
        <div className="border-t border-warning/20 px-4 py-2">
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm text-text-muted underline-offset-2 hover:text-text hover:underline"
          >
            {t("dupTryAnother")}
          </button>
        </div>
      )}
    </div>
  );
}
