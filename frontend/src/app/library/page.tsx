"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Library, Plus } from "lucide-react";
import { gql } from "@/lib/graphql";
import { CREATE_PLAYLIST, MY_PLAYLISTS } from "@/lib/queries";
import type { Connection, Playlist } from "@/lib/types";
import { useLocale } from "@/providers/LocaleProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { PlaylistCard } from "@/components/music/PlaylistCard";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingBlock } from "@/components/ui/States";

function CreatePlaylistModal({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "unlisted">("public");

  const mutation = useMutation({
    mutationFn: () =>
      gql(CREATE_PLAYLIST, { input: { name, description: description || undefined, visibility } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["myPlaylists"] });
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose} title={t("newPlaylist")}>
      <div className="space-y-4">
        <Field label={t("playlistName")}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("description")}>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label={t("visibility")}>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
            className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-2.5 text-text focus:border-primary/70 focus:outline-none"
          >
            <option value="public">{t("public")}</option>
            <option value="unlisted">{t("unlisted")}</option>
            <option value="private">{t("private")}</option>
          </select>
        </Field>
        <Button
          className="w-full"
          loading={mutation.isPending}
          disabled={!name.trim()}
          onClick={() => mutation.mutate()}
        >
          {t("create")}
        </Button>
      </div>
    </Modal>
  );
}

function LibraryContent() {
  const { t } = useLocale();
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["myPlaylists"],
    queryFn: () => gql<{ myPlaylists: Connection<Playlist> }>(MY_PLAYLISTS, { first: 50 }),
  });

  const playlists = data?.myPlaylists.nodes ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-4xl tracking-wide text-text">{t("nav_library")}</h1>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" />
          {t("createPlaylist")}
        </Button>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : playlists.length === 0 ? (
        <EmptyState icon={<Library className="h-10 w-10" />} title={t("emptyLibrary")}>
          <Button className="mt-2" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {t("createPlaylist")}
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {playlists.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </div>
      )}

      {creating && <CreatePlaylistModal onClose={() => setCreating(false)} />}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <RequireAuth>
      <LibraryContent />
    </RequireAuth>
  );
}
