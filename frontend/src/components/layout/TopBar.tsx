"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Menu, Moon, Search, Sun, User as UserIcon, X, Languages } from "lucide-react";
import { gql } from "@/lib/graphql";
import { UNREAD_COUNT } from "@/lib/queries";
import { useLocale } from "@/providers/LocaleProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Brand, SidebarNav } from "./Sidebar";

function LocaleToggle() {
  const { locale, toggleLocale } = useLocale();
  return (
    <button
      type="button"
      onClick={toggleLocale}
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-primary/50 hover:text-text cursor-pointer"
      title="Language / زبان"
    >
      <Languages className="h-4 w-4" />
      <span className="font-medium">{locale === "en" ? "EN" : "فا"}</span>
    </button>
  );
}

function ThemeToggle() {
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
      className="grid h-9 w-9 place-items-center rounded-full border border-border text-text-muted transition-colors hover:border-primary/50 hover:text-text cursor-pointer"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function NotificationsBell() {
  const { user } = useAuth();
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
      className="relative grid h-10 w-10 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-text"
      aria-label="Notifications"
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

function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("nav_profile")}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        className="flex items-center gap-2 rounded-full p-0.5 transition-transform hover:scale-105 cursor-pointer"
      >
        <Avatar name={user.displayName} src={user.avatarUrl} id={user.id} size={36} />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-card ltr:right-0 rtl:left-0">
            <div className="border-b border-border px-4 py-3">
              <p className="truncate font-medium text-text">{user.displayName}</p>
              <p className="truncate text-xs text-text-faint">{user.email}</p>
            </div>
            <Link
              href="/me"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface hover:text-text"
            >
              <UserIcon className="h-4 w-4" />
              {t("nav_profile")}
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-danger transition-colors hover:bg-surface cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
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
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-10 w-10 place-items-center rounded-full text-text-muted hover:bg-surface hover:text-text lg:hidden cursor-pointer"
        aria-label="Menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 w-72 max-w-[80vw] space-y-6 bg-bg-elevated p-5 shadow-card ltr:left-0 rtl:right-0">
            <div className="flex items-center justify-between">
              <Brand onClick={() => setOpen(false)} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full text-text-muted hover:bg-surface cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-bg/80 px-4 py-3 backdrop-blur-xl sm:px-6">
      <MobileMenu />
      <div className="lg:hidden">
        <Brand />
      </div>
      <SearchBar />
      <div className="ltr:ml-auto rtl:mr-auto flex items-center gap-2">
        <ThemeToggle />
        <LocaleToggle />
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}
