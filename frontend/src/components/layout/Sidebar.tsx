"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Sparkles,
  Search,
  Library,
  Upload,
  Bell,
  Shield,
  Music4,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/providers/LocaleProvider";
import { useAuth } from "@/providers/AuthProvider";
import type { Dict } from "@/i18n/dictionaries";

interface NavItem {
  href: string;
  labelKey: keyof Dict;
  icon: typeof Home;
  admin?: boolean;
  auth?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", labelKey: "nav_home", icon: Home },
  { href: "/for-you", labelKey: "nav_forYou", icon: Sparkles, auth: true },
  { href: "/search", labelKey: "nav_search", icon: Search },
  { href: "/library", labelKey: "nav_library", icon: Library, auth: true },
  { href: "/upload", labelKey: "nav_upload", icon: Upload, auth: true },
  { href: "/notifications", labelKey: "nav_notifications", icon: Bell, auth: true },
  { href: "/admin", labelKey: "nav_admin", icon: Shield, admin: true },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { user, isAdmin } = useAuth();

  return (
    <nav className="flex flex-col gap-1">
      {NAV.filter((item) => {
        if (item.admin) return isAdmin;
        if (item.auth) return Boolean(user);
        return true;
      }).map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-surface text-text"
                : "text-text-muted hover:bg-surface/60 hover:text-text",
            )}
          >
            <Icon
              className={cn("h-5 w-5 shrink-0", active && "text-primary")}
              strokeWidth={active ? 2.4 : 2}
            />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

export function Brand({ onClick }: { onClick?: () => void }) {
  const { t } = useLocale();
  return (
    <Link href="/" onClick={onClick} className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
        <Music4 className="h-5 w-5 text-white" />
      </span>
      <span className="font-heading text-xl tracking-wide text-text">{t("appName")}</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 z-30 hidden w-64 flex-col gap-6 border-border bg-bg-elevated/70 p-5 backdrop-blur-xl lg:flex ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l">
      <Brand />
      <SidebarNav />
      <div className="mt-auto text-xs text-text-faint">
        <p>Harmony · بلندگوی صداهای تازه</p>
      </div>
    </aside>
  );
}
