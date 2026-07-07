"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Music4 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale } from "@/providers/LocaleProvider";
import { GraphQLError } from "@/lib/graphql";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

export default function RegisterPage() {
  const { register } = useAuth();
  const { t, locale } = useLocale();
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    mobileNumber: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({
        displayName: form.displayName,
        email: form.email,
        password: form.password,
        mobileNumber: form.mobileNumber || undefined,
        locale,
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof GraphQLError ? err.message : t("somethingWrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
          <Music4 className="h-7 w-7 text-white" />
        </span>
        <h1 className="font-heading text-3xl tracking-wide text-text">{t("createAccount")}</h1>
        <p className="mt-2 text-text-muted">{t("tagline")}</p>
      </div>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-card border border-border bg-surface/50 p-6"
      >
        <Field label={t("displayName")} htmlFor="name">
          <Input id="name" required value={form.displayName} onChange={set("displayName")} />
        </Field>
        <Field label={t("email")} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set("email")}
          />
        </Field>
        <Field label={t("password")} htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={form.password}
            onChange={set("password")}
          />
        </Field>
        <Field label={t("mobileOptional")} htmlFor="mobile">
          <Input id="mobile" value={form.mobileNumber} onChange={set("mobileNumber")} />
        </Field>

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? t("signingUp") : t("register")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
