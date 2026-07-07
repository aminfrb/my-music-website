"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { gql } from "@/lib/graphql";
import { REACT } from "@/lib/queries";
import { REACTIONS } from "@/i18n/dictionaries";
import { useLocale } from "@/providers/LocaleProvider";
import { useAuth } from "@/providers/AuthProvider";
import type { Music, ReactionType } from "@/lib/types";

export function ReactionBar({ music }: { music: Music }) {
  const { locale } = useLocale();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mine, setMine] = useState<ReactionType | null>(music.myReaction ?? null);

  const mutation = useMutation({
    mutationFn: (type: ReactionType) =>
      gql<{ reactToMusic: Music }>(REACT, { musicId: music.id, type }),
    onSuccess: (data) => {
      setMine(data.reactToMusic.myReaction ?? null);
      void queryClient.invalidateQueries({ queryKey: ["music", music.id] });
    },
  });

  const disabled = !user || mutation.isPending;

  return (
    <div className="flex flex-wrap gap-2">
      {REACTIONS.map((r) => {
        const selected = mine === r.type;
        return (
          <button
            key={r.type}
            type="button"
            disabled={disabled}
            onClick={() => mutation.mutate(r.type)}
            title={locale === "fa" ? r.labelFa : r.labelEn}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? "border-primary bg-primary/15 text-text"
                : "border-border bg-surface/60 text-text-muted hover:border-primary/50 hover:text-text",
            )}
          >
            <span className="text-base leading-none">{r.emoji}</span>
            <span>{locale === "fa" ? r.labelFa : r.labelEn}</span>
          </button>
        );
      })}
    </div>
  );
}
