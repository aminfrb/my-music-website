"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Search,
  Sun,
  User as UserIcon,
  X,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { gql } from "@/lib/graphql";
import { UNREAD_COUNT, UNREAD_MESSAGES } from "@/lib/queries";
import { useLocale } from "@/providers/LocaleProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Portal, useOverlay, useDismissOnOutsideClick } from "@/components/ui/Overlay";
import { Brand, SidebarNav } from "./Sidebar";

/** Icon-only controls; 44px is the smallest comfortable touch target. */
const ICON_BUTTON =
  "grid h-11 w-11 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-text cursor-pointer";

function LocaleToggle({ className }: { className?: string }) {
  const { locale, toggleLocale } = useLocale();
  return (
    <button
      type="button"
      onClick={toggleLocale}
      className={cn(
        "flex h-11 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm text-text-muted transition-colors hover:border-primary/50 hover:text-text cursor-pointer",
        className,
      )}
      aria-label="Language / زبان"
      title="Language / زبان"
    >
      <Languages className="h-4 w-4 shrink-0" />
      <span className="font-medium">{locale === "en" ? "EN" : "فا"}</span>
    </button>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLocale();
  const isDark = theme === "dark";
  const label = isDark ? t("themeLight") : t("themeDark");
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-text-muted transition-colors hover:border-primary/50 hover:text-text cursor-pointer",
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function NotificationsBell() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { data } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: () => gql<{ unreadNotificationCount: number }>(UNREAD_COUNT),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });
  if (!user) return null;
  const count = data?.unreadNotificationCount ?? 0;
  return (
    <Link
      href="/notifications"
      className={cn(ICON_BUTTON, "relative")}
      aria-label={t("nav_notifications")}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white ltr:right-1 rtl:left-1">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

function MessagesBell() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { data } = useQuery({
    queryKey: ["unreadMessages"],
    queryFn: () => gql<{ unreadMessageCount: number }>(UNREAD_MESSAGES),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });
  if (!user) return null;
  const count = data?.unreadMessageCount ?? 0;
  return (
    <Link
      href="/messages"
      aria-label={t("nav_messages")}
      className={cn(ICON_BUTTON, "relative")}
    >
      <MessageCircle className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white ltr:right-1 rtl:left-1">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useDismissOnOutsideClick<HTMLDivElement>(open, () => setOpen(false));

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login">
          <Button variant="ghost" size="sm">
            {t("login")}
          </Button>
        </Link>
        <Link href="/register" className="hidden sm:block">
          <Button size="sm">{t("register")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("nav_profile")}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-surface cursor-pointer"
      >
        <Avatar name={user.displayName} src={user.avatarUrl} id={user.id} size={36} />
      </button>
      {open && (
        <>
          <div
            role="menu"
            aria-label={t("nav_profile")}
            className="absolute z-50 mt-2 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-card ltr:right-0 rtl:left-0"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate font-medium text-text">{user.displayName}</p>
              <p className="truncate text-xs text-text-faint">{user.email}</p>
            </div>
            <Link
              href="/me"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-2.5 px-4 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface hover:text-text"
            >
              <UserIcon className="h-4 w-4 shrink-0" />
              {t("nav_profile")}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-sm text-danger transition-colors hover:bg-surface cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {t("logout")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SearchBar() {
  const { t } = useLocale();
  const router = useRouter();
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) router.push(`/search?q=${encodeURIComponent(value.trim())}`);
      }}
      className="relative hidden max-w-md flex-1 sm:block"
    >
      <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint ltr:left-3.5 rtl:right-3.5" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="w-full rounded-full border border-border bg-surface/70 py-2 text-sm text-text placeholder:text-text-faint focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25 ltr:pl-10 ltr:pr-4 rtl:pr-10 rtl:pl-4"
      />
    </form>
  );
}

function MobileMenu() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const panelRef = useOverlay(open, () => setOpen(false));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("openMenu")}
        aria-expanded={open ? "true" : "false"}
        className={cn(ICON_BUTTON, "lg:hidden")}
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        /* Portalled to <body>: the header's `backdrop-blur` would otherwise be
           the containing block for this `fixed` overlay, sizing it to the
           header strip instead of the screen. */
        <Portal>
          <div data-overlay className="fixed inset-0 z-50 lg:hidden">
            {/* Click-to-dismiss backdrop, hidden from assistive tech — it
                duplicated the close button's name. A focusable element must
                never be aria-hidden, so this is a div, not a button. */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
              aria-hidden="true"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={t("primaryNav")}
              className={cn(
                "absolute inset-y-0 flex w-[17.5rem] max-w-[85vw] flex-col gap-6 overflow-y-auto overscroll-contain bg-bg-elevated p-5 shadow-card",
                // Reachable on a short screen, and clear of the home indicator.
                "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
                // Slides in from whichever edge the current direction starts at.
                "animate-drawer-in ltr:left-0 ltr:[--drawer-from:-100%] rtl:right-0 rtl:[--drawer-from:100%]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Brand onClick={() => setOpen(false)} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={cn(ICON_BUTTON, "-mr-1 rtl:-ml-1 rtl:mr-0")}
                  aria-label={t("close")}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav onNavigate={() => setOpen(false)} />
              {/* The header has no room for these on a phone, so they live
                  here instead of overflowing off the edge of the screen. */}
              <div className="mt-auto flex items-center gap-2 border-t border-border pt-5">
                <ThemeToggle />
                <LocaleToggle />
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-bg/80 px-3 py-2 backdrop-blur-xl sm:gap-3 sm:px-6 sm:py-3">
      <MobileMenu />
      {/* `min-w-0` lets the brand give up space instead of shoving the account
          controls off the edge — at 320px there is not room for both. */}
      <div className="min-w-0 lg:hidden">
        <Brand compact />
      </div>
      <SearchBar />
      <div className="ltr:ml-auto rtl:mr-auto flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Below `lg` these two live in the drawer, which has room for them. */}
        <ThemeToggle className="hidden lg:grid" />
        <LocaleToggle className="hidden lg:flex" />
        <MessagesBell />
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}
