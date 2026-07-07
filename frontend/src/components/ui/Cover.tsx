import { Music2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { gradientFromId } from "@/lib/format";

export function Cover({
  src,
  id,
  alt,
  rounded = "rounded-xl",
  className,
}: {
  src?: string | null;
  id: string;
  alt: string;
  rounded?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("relative aspect-square w-full overflow-hidden", rounded, className)}
      style={{ background: src ? undefined : gradientFromId(id) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Music2 className="h-1/3 w-1/3 text-white/70" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
