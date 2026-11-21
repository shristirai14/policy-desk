import { ShieldCheck } from "lucide-react";
import { cn } from "cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      <ShieldCheck className="size-4" />
    </span>
  );
}

export function Brand({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 text-[15px] font-semibold tracking-tight", className)}>
      <BrandMark className={markClassName} />
      PolicyDesk
    </div>
  );
}
