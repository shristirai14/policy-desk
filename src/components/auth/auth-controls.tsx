import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export function AuthSubmit({
  pending,
  pendingLabel,
  disabled,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending || disabled} aria-busy={pending}>
      {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
      {pending ? pendingLabel : children}
      {pending ? null : (
        <ArrowRight
          data-icon="inline-end"
          className="transition-transform duration-200 ease-out group-hover/button:translate-x-0.5"
        />
      )}
    </Button>
  );
}

export function AuthLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-sm text-[13px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function AuthTextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm text-[13px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}
