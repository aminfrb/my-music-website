"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Flag, ListPlus, Share2 } from "lucide-react";
import { gql } from "@/lib/graphql";
import {
  ADD_TO_PLAYLIST,
  CREATE_PLAYLIST,
  MY_PLAYLISTS,
  REPORT_MUSIC,
} from "@/lib/queries";
import type { Connection, Music, Playlist, ReportReason } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale } from "@/providers/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

const REPORT_REASONS: ReportReason[] = [
  "inappropriate_content",
  "copyright",
  "inappropriate_title_or_cover",
  "broken_file",
  "spam",
  "other",
];

export function TrackActions({ music }: { music: Music }) {
  const { user } = useAuth();
  const { t } = useLocale();
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/music/${music.id}`;
    try {
      if (navigator.share) await navigator.share({ title: music.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {user && (
        <Button variant="outline" size="sm" onClick={() => setShowPlaylists(true)}>
          <ListPlus className="h-4 w-4" />
          {t("addToPlaylist")}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={share}>
        {copied ? <Check className="h-4 w-4 text-play" /> : <Share2 className="h-4 w-4" />}
        {copied ? t("copied") : t("share")}
      </Button>
      {user && (
        <Button variant="ghost" size="sm" onClick={() => setShowReport(true)}>
          <Flag className="h-4 w-4" />
          {t("report")}
        </Button>
      )}

      {showPlaylists && (
        <AddToPlaylistModal music={music} onClose={() => setShowPlaylists(false)} />
      )}
      {showReport && (
        <ReportModal music={music} reasons={REPORT_REASONS} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}

function AddToPlaylistModal({ music, onClose }: { music: Music; onClose: () => void }) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const { data } = useQuery({
    queryKey: ["myPlaylists"],
    queryFn: () => gql<{ myPlaylists: Connection<Playlist> }>(MY_PLAYLISTS, { first: 50 }),
  });

  const addMutation = useMutation({
    mutationFn: (playlistId: string) =>
      gql(ADD_TO_PLAYLIST, { playlistId, musicId: music.id }),
    onSuccess: (_d, playlistId) => {
      setAdded((s) => new Set(s).add(playlistId));
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      gql<{ createPlaylist: Playlist }>(CREATE_PLAYLIST, {
        input: { name: newName, visibility: "public" },
      }),
    onSuccess: async (d) => {
      setNewName("");
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["myPlaylists"] });
      addMutation.mutate(d.createPlaylist.id);
    },
  });

  const playlists = data?.myPlaylists.nodes ?? [];

  return (
    <Modal open onClose={onClose} title={t("addToPlaylist")}>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {playlists.map((p) => {
          const done = added.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={done || addMutation.isPending}
              onClick={() => addMutation.mutate(p.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-surface disabled:opacity-70 cursor-pointer"
            >
              <span className="truncate text-text">{p.name}</span>
              {done ? (
                <Check className="h-4 w-4 text-play" />
              ) : (
                <ListPlus className="h-4 w-4 text-text-muted" />
              )}
            </button>
          );
        })}
        {playlists.length === 0 && (
          <p className="px-3 py-4 text-sm text-text-muted">{t("emptyLibrary")}</p>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        {creating ? (
          <div className="space-y-3">
            <Field label={t("playlistName")}>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("newPlaylist")}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={createMutation.isPending}
                disabled={!newName.trim()}
                onClick={() => createMutation.mutate()}
              >
                {t("create")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setCreating(true)}>
            <ListPlus className="h-4 w-4" />
            {t("createPlaylist")}
          </Button>
        )}
      </div>
    </Modal>
  );
}

function ReportModal({
  music,
  reasons,
  onClose,
}: {
  music: Music;
  reasons: ReportReason[];
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [reason, setReason] = useState<ReportReason>(reasons[0]);
  const [details, setDetails] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      gql(REPORT_MUSIC, {
        input: { musicId: music.id, reason, description: details || undefined },
      }),
  });

  return (
    <Modal open onClose={onClose} title={t("reportTrack")}>
      {mutation.isSuccess ? (
        <p className="py-6 text-center text-text-muted">{t("reportThanks")}</p>
      ) : (
        <div className="space-y-4">
          <Field label={t("reportReason")}>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              aria-label={t("reportReason")}
              className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-2.5 text-text focus:border-primary/70 focus:outline-none"
            >
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {t(`reason_${r}` as never)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("reportDetails")}>
            <Input value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          <Button
            className="w-full"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("submitReport")}
          </Button>
        </div>
      )}
    </Modal>
  );
}
