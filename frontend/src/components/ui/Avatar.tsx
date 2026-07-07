import { cn } from "@/lib/cn";
import { gradientFromId } from "@/lib/format";

export function Avatar({
  name,
  src,
  id,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  id?: string;
  size?: number;
  className?: string;
}) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: src ? undefined : gradientFromId(id ?? name ?? "x"),
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
