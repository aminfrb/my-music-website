"use client";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { MessagesShell } from "@/components/messages/MessagesShell";
import { useLocale } from "@/providers/LocaleProvider";

function Placeholder() {
  const { t } = useLocale();
  return (
    <div className="grid h-full place-items-center rounded-card border border-border bg-surface/40 px-6 text-center text-text-muted">
      {t("msgSelect")}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <RequireAuth>
      <MessagesShell>
        <Placeholder />
      </MessagesShell>
    </RequireAuth>
  );
}
