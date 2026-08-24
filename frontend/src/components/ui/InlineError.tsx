"use client";

import { GraphQLError } from "@/lib/graphql";
import { cn } from "@/lib/cn";
import { useLocale } from "@/providers/LocaleProvider";

/**
 * Inline failure message for an action the user just took — a follow, a save,
 * a send. Renders nothing until something fails.
 *
 * Server errors already arrive localized and specific ("You are already
 * following this user."), so those are shown as-is; anything else is a
 * transport failure the user can only retry, and gets the generic line.
 *
 * `role="alert"` so a screen reader announces the failure — the button it sits
 * under simply returns to its idle label, which is silent on its own.
 */
export function InlineError({
  error,
  className,
}: {
  error: unknown;
  className?: string;
}) {
  const { t } = useLocale();
  if (!error) return null;
  const message = error instanceof GraphQLError ? error.message : t("actionFailed");
  return (
    <p role="alert" className={cn("text-xs text-danger", className)}>
      {message}
    </p>
  );
}
