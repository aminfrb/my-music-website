"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/providers/LocaleProvider";
import { MusicCard } from "./MusicCard";
import type { Music } from "@/lib/types";

export function SectionHeader({
  title,
  href,
}: {
  title: string;
  href?: string;
}) {
  const { t, dir } = useLocale();
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="font-heading text-xl tracking-wide text-text">{title}</h2>
      {href && (
        <Link
          href={href}
          className="group flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary"
        >
          {t("seeAll")}
          <Chevron className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export function MusicRail({
  title,
  href,
  tracks,
}: {
  title: string;
  href?: string;
  tracks: Music[];
}) {
  if (!tracks?.length) return null;
  return (
    <section className="animate-fade-up">
      <SectionHeader title={title} href={href} />
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {tracks.map((track) => (
          <div key={track.id} className="w-44 shrink-0 sm:w-48">
            <MusicCard music={track} queue={tracks} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Responsive grid variant (for full listing pages). */
export function MusicGrid({ tracks }: { tracks: Music[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {tracks.map((track) => (
        <MusicCard key={track.id} music={track} queue={tracks} />
      ))}
    </div>
  );
}
