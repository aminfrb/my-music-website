"use client";

import { Loader2 } from "lucide-react";
import { useLocale } from "@/providers/LocaleProvider";
import { Button } from "./Button";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={`animate-spin text-primary ${className ?? "h-6 w-6"}`} />;
}

export function LoadingBlock() {
  const { t } = useLocale();
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-text-muted">
      <Spinner />
      <span>{t("loading")}</span>
    </div>
  );
}

export function ErrorBlock({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-text-muted">{t("somethingWrong")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
      {icon && <div className="text-text-faint">{icon}</div>}
      <p className="text-lg font-medium text-text">{title}</p>
      {children && <div className="text-sm text-text-muted">{children}</div>}
    </div>
  );
}

/** Simple skeleton card grid for loading rails. */
export function SkeletonRail({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-40 shrink-0 animate-pulse">
          <div className="aspect-square w-full rounded-xl bg-surface" />
          <div className="mt-3 h-3 w-3/4 rounded bg-surface" />
          <div className="mt-2 h-3 w-1/2 rounded bg-surface" />
        </div>
      ))}
    </div>
  );
}
