import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="font-heading text-7xl tracking-wide text-primary">404</p>
      <p className="text-text-muted">This page hit a wrong note.</p>
      <Link
        href="/"
        className="rounded-xl bg-gradient-brand px-5 py-2.5 font-medium text-white shadow-glow transition-transform hover:scale-105"
      >
        Back home
      </Link>
    </div>
  );
}
