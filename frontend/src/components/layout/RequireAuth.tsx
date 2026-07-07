"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale } from "@/providers/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/States";

export function RequireAuth({
  children,
  admin,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  const { user, loading, isAdmin } = useAuth();
  const { t } = useLocale();

  if (loading) return <LoadingBlock />;

  if (!user || (admin && !isAdmin)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-text-muted">
          <Lock className="h-6 w-6" />
        </span>
        <p className="text-lg font-medium text-text">{t("loginRequired")}</p>
        <div className="flex gap-3">
          <Link href="/login">
            <Button>{t("login")}</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline">{t("register")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
