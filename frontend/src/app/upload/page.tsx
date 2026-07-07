"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  FileAudio,
  ImagePlus,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { gql, GraphQLError, putToPresignedUrl } from "@/lib/graphql";
import {
  CREATE_UPLOAD_SESSION,
  FINALIZE_AUDIO_UPLOAD,
  FINALIZE_COVER_UPLOAD,
  PUBLISH_UPLOAD,
  REQUEST_AUDIO_UPLOAD,
  REQUEST_COVER_UPLOAD,
  SET_UPLOAD_METADATA,
  UPLOAD_GENRES,
} from "@/lib/queries";
import type { Genre, PresignedUpload, UploadSession } from "@/lib/types";
import { formatBytes, formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useLocale } from "@/providers/LocaleProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import type { Dict } from "@/i18n/dictionaries";

type Step = 0 | 1 | 2 | 3;

function Stepper({ step }: { step: Step }) {
  const { t } = useLocale();
  const labels: Array<keyof Dict> = [
    "uploadStepFile",
    "uploadStepDetails",
    "uploadStepCover",
    "uploadStepReview",
  ];
  return (
    <ol className="mb-8 flex items-center gap-2">
      {labels.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors",
                done && "bg-play text-black",
                active && "bg-gradient-brand text-white",
                !done && !active && "bg-surface text-text-muted",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-sm sm:block",
                active ? "text-text" : "text-text-muted",
              )}
            >
              {t(label)}
            </span>
            {i < labels.length - 1 && (
              <span className="h-px flex-1 bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function UploadContent() {
  const { t } = useLocale();
  const audioInput = useRef<HTMLInputElement | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>(0);
  const [done, setDone] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [audioName, setAudioName] = useState<string>("");
  const [audioInfo, setAudioInfo] = useState<{ size?: number | null; duration?: number | null } | null>(
    null,
  );

  const [meta, setMeta] = useState({
    title: "",
    artistName: "",
    genreId: "",
    tags: "",
    description: "",
    visibility: "public" as "public" | "private",
  });

  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const { data: genreData } = useQuery({
    queryKey: ["uploadGenres"],
    queryFn: () => gql<{ genres: Genre[] }>(UPLOAD_GENRES),
  });
  const genres = genreData?.genres ?? [];

  const fail = (err: unknown) =>
    setError(err instanceof GraphQLError ? err.message : t("somethingWrong"));

  /* Step 0 — audio upload */
  const onAudioSelected = async (file: File) => {
    setError(null);
    setBusy(true);
    setAudioName(file.name);
    try {
      let sid = sessionId;
      if (!sid) {
        const created = await gql<{ createUploadSession: UploadSession }>(
          CREATE_UPLOAD_SESSION,
        );
        sid = created.createUploadSession.id;
        setSessionId(sid);
      }
      const presign = await gql<{ requestAudioUpload: PresignedUpload }>(
        REQUEST_AUDIO_UPLOAD,
        { sessionId: sid, contentType: file.type || "audio/mpeg" },
      );
      await putToPresignedUrl(presign.requestAudioUpload.url, file);
      const finalized = await gql<{ finalizeAudioUpload: UploadSession }>(
        FINALIZE_AUDIO_UPLOAD,
        { sessionId: sid },
      );
      setAudioInfo({
        size: finalized.finalizeAudioUpload.audio?.size,
        duration: finalized.finalizeAudioUpload.audio?.duration,
      });
      if (!meta.title) {
        setMeta((m) => ({ ...m, title: file.name.replace(/\.[^.]+$/, "") }));
      }
      setStep(1);
    } catch (err) {
      fail(err);
      setAudioName("");
    } finally {
      setBusy(false);
    }
  };

  /* Step 1 — metadata */
  const submitMetadata = async () => {
    if (!sessionId) return;
    setError(null);
    setBusy(true);
    try {
      const tags = meta.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await gql(SET_UPLOAD_METADATA, {
        sessionId,
        input: {
          title: meta.title,
          artistName: meta.artistName,
          description: meta.description || undefined,
          genreId: meta.genreId || undefined,
          tags,
          visibility: meta.visibility,
          duration: audioInfo?.duration ?? undefined,
        },
      });
      setStep(2);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  /* Step 2 — cover (optional) */
  const onCoverSelected = async (file: File) => {
    if (!sessionId) return;
    setError(null);
    setBusy(true);
    try {
      const presign = await gql<{ requestCoverUpload: PresignedUpload }>(
        REQUEST_COVER_UPLOAD,
        { sessionId, contentType: file.type || "image/jpeg" },
      );
      await putToPresignedUrl(presign.requestCoverUpload.url, file);
      await gql(FINALIZE_COVER_UPLOAD, { sessionId });
      setCoverPreview(URL.createObjectURL(file));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  /* Step 3 — publish */
  const publish = async () => {
    if (!sessionId) return;
    setError(null);
    setBusy(true);
    try {
      await gql(PUBLISH_UPLOAD, { sessionId });
      setDone(true);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(0);
    setDone(false);
    setSessionId(null);
    setAudioName("");
    setAudioInfo(null);
    setCoverPreview(null);
    setMeta({
      title: "",
      artistName: "",
      genreId: "",
      tags: "",
      description: "",
      visibility: "public",
    });
    setError(null);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 font-heading text-4xl tracking-wide text-text">{t("uploadTitle")}</h1>
      <p className="mb-8 text-text-muted">{t("heroSubtitle")}</p>

      {!done && <Stepper step={step} />}

      {error && (
        <p className="mb-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {done ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface/40 py-12 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-play/15 text-play">
            <Check className="h-8 w-8" />
          </span>
          <h2 className="font-heading text-2xl tracking-wide text-text">{t("uploadDone")}</h2>
          <p className="max-w-sm text-sm text-text-muted">{t("uploadPendingNote")}</p>
          <div className="mt-2 flex gap-3">
            <Button onClick={reset}>{t("uploadAnother")}</Button>
            <Link href="/me">
              <Button variant="outline">{t("nav_profile")}</Button>
            </Link>
          </div>
        </div>
      ) : (
      <div className="rounded-card border border-border bg-surface/40 p-6">
        {/* STEP 0 — audio */}
        {step === 0 && (
          <div>
            <input
              ref={audioInput}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onAudioSelected(f);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => audioInput.current?.click()}
              className="flex w-full flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border py-16 text-center transition-colors hover:border-primary/60 hover:bg-surface/60 disabled:opacity-70 cursor-pointer"
            >
              {busy ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <span className="text-text-muted">{t("validating")}</span>
                  {audioName && <span className="text-sm text-text-faint">{audioName}</span>}
                </>
              ) : (
                <>
                  <UploadCloud className="h-10 w-10 text-primary" />
                  <span className="font-medium text-text">{t("dropAudio")}</span>
                  <span className="text-sm text-text-faint">{t("audioFormats")}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 1 — details */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-play/10 px-4 py-3 text-sm text-play">
              <FileAudio className="h-5 w-5" />
              <span>{t("fileValidated")}</span>
              <span className="ltr:ml-auto rtl:mr-auto text-text-faint">
                {audioInfo?.size ? formatBytes(audioInfo.size) : ""}
                {audioInfo?.duration ? ` · ${formatDuration(audioInfo.duration)}` : ""}
              </span>
            </div>

            <Field label={t("title")}>
              <Input
                value={meta.title}
                onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              />
            </Field>
            <Field label={t("artistName")}>
              <Input
                value={meta.artistName}
                onChange={(e) => setMeta((m) => ({ ...m, artistName: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("genre")}>
                <select
                  value={meta.genreId}
                  onChange={(e) => setMeta((m) => ({ ...m, genreId: e.target.value }))}
                  aria-label={t("genre")}
                  className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-2.5 text-text focus:border-primary/70 focus:outline-none"
                >
                  <option value="">—</option>
                  {genres.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("visibility")}>
                <select
                  value={meta.visibility}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, visibility: e.target.value as "public" | "private" }))
                  }
                  aria-label={t("visibility")}
                  className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-2.5 text-text focus:border-primary/70 focus:outline-none"
                >
                  <option value="public">{t("public")}</option>
                  <option value="private">{t("private")}</option>
                </select>
              </Field>
            </div>
            <Field label={t("tags")} hint={t("tagsHint")}>
              <Input
                value={meta.tags}
                onChange={(e) => setMeta((m) => ({ ...m, tags: e.target.value }))}
              />
            </Field>
            <Field label={t("description")}>
              <Textarea
                value={meta.description}
                onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                loading={busy}
                disabled={!meta.title.trim() || !meta.artistName.trim()}
                onClick={submitMetadata}
              >
                {t("next_")}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — cover */}
        {step === 2 && (
          <div className="space-y-4">
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onCoverSelected(f);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => coverInput.current?.click()}
              className="flex w-full flex-col items-center gap-3 overflow-hidden rounded-xl border-2 border-dashed border-border py-10 text-center transition-colors hover:border-primary/60 hover:bg-surface/60 cursor-pointer"
            >
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreview}
                  alt="cover"
                  className="h-40 w-40 rounded-xl object-cover"
                />
              ) : busy ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              ) : (
                <>
                  <ImagePlus className="h-10 w-10 text-primary" />
                  <span className="font-medium text-text">{t("dropImage")}</span>
                  <span className="text-sm text-text-faint">{t("addCoverOptional")}</span>
                </>
              )}
            </button>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                {t("back")}
              </Button>
              <Button loading={busy} onClick={() => setStep(3)}>
                {t("next_")}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — review & publish */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-surface">
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverPreview} alt="cover" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-text-faint">
                    <FileAudio className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-heading text-2xl tracking-wide text-text">
                  {meta.title || "—"}
                </p>
                <p className="truncate text-text-muted">{meta.artistName}</p>
                <p className="mt-1 text-sm text-text-faint">
                  {genres.find((g) => g.id === meta.genreId)?.name ?? ""}
                  {audioInfo?.duration ? ` · ${formatDuration(audioInfo.duration)}` : ""}
                </p>
              </div>
            </div>

            {meta.tags.trim() && (
              <div className="flex flex-wrap gap-2">
                {meta.tags
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-surface px-3 py-1 text-sm text-text-muted"
                    >
                      #{tag}
                    </span>
                  ))}
              </div>
            )}

            <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
              {t("uploadPendingNote")}
            </p>

            <div className="flex justify-between gap-2 pt-1">
              <Button variant="ghost" onClick={() => setStep(2)}>
                {t("back")}
              </Button>
              <Button variant="play" size="lg" loading={busy} onClick={publish}>
                {busy ? t("publishing") : t("publish")}
              </Button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  return (
    <RequireAuth>
      <UploadContent />
    </RequireAuth>
  );
}
