"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders `children` into `<body>`, outside the app's own boxes.
 *
 * An overlay can't be laid out where it happens to be written. `backdrop-filter`,
 * `filter` and `transform` each make an element the containing block for its
 * `position: fixed` descendants, and each opens a stacking context that traps
 * them underneath. The top bar carries `backdrop-blur`, so a drawer written
 * inside it measured `inset-0` against the header's 64px strip instead of the
 * viewport — the panel collapsed to the height of the header and the nav
 * floated over the page with nothing behind it.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // There is no document to portal into until the client has mounted.
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

/**
 * The behaviour every overlay owes the person using it: Escape dismisses it,
 * the page behind stops scrolling, focus moves in on open, Tab stays inside,
 * and focus returns to whatever opened it on close.
 *
 * Returns a ref to put on the panel, which needs `tabIndex={-1}` so it can hold
 * focus itself. It is a
 * callback ref rather than an object ref because the panel is portalled, so it
 * attaches a commit later than this hook first runs; keying the effect on the
 * node means setup waits for the panel to actually exist.
 */
export function useOverlay(open: boolean, onClose: () => void) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  // Held in a ref so an inline `() => setOpen(false)` doesn't re-run the effect
  // on every render and yank focus back to the top of the panel.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !panel) return;

    const opener = document.activeElement as HTMLElement | null;

    // Pinning the body rather than just hiding its overflow: iOS Safari
    // scrolls the page behind an `overflow: hidden` body regardless, which
    // drags the overlay out from under the finger. Fixing the body freezes it
    // everywhere, at the cost of having to put the scroll position back.
    const { body } = document;
    const scrollY = window.scrollY;
    const restore = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    const focusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      );

    // The panel itself takes focus, not its first control: landing on the close
    // button would make Enter or Space — the very next keys someone might
    // press — dismiss what just opened. Tab from here reaches the controls.
    panel.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      // The page behind is inert to touch while the overlay is up, so it should
      // be inert to the keyboard too.
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      Object.assign(body.style, restore);
      window.scrollTo(0, scrollY);
      opener?.focus?.();
    };
  }, [open, panel]);

  return setPanel;
}

/**
 * Closes a popover when a pointer goes down anywhere outside it.
 *
 * A `fixed inset-0` click-catcher is the usual shortcut, but it inherits the
 * same containing-block trap as the drawer above: inside a `backdrop-blur`
 * header it covers only the header, so tapping the page below never dismissed
 * anything. Listening on the document has no geometry to get wrong.
 */
export function useDismissOnOutsideClick<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return ref;
}
