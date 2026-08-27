"use client";

import { useId } from "react";
import { X } from "lucide-react";
import { useLocale } from "@/providers/LocaleProvider";
import { Portal, useOverlay } from "@/components/ui/Overlay";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const titleId = useId();
  // Escape, scroll lock, focus in and back out again.
  const panelRef = useOverlay(open, onClose);

  if (!open) return null;

  return (
    /* Portalled so `inset-0` is measured against the viewport rather than
       whichever ancestor happens to carry a filter or transform. */
    <Portal>
      <div
        data-overlay
        className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        {/* Click-to-dismiss backdrop. Hidden from assistive tech: it duplicated
            the close button's name, and a keyboard or screen-reader user closes
            with Escape or that button instead. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
        />
        {/* Announced as a dialog and named by its heading, so a screen-reader
            user knows they've entered one and what it is. */}
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="animate-fade-up relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-card border border-border bg-bg-elevated p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-card sm:rounded-card sm:pb-5"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 id={titleId} className="font-heading text-xl tracking-wide text-text">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface hover:text-text cursor-pointer rtl:-ml-1 rtl:mr-0"
              aria-label={t("close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}
