import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign your documents", robots: { index: false, follow: false } };
export const instant = false;

export default function EsignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-2 px-4 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          PolicyDesk
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">{children}</main>
      <footer className="border-t bg-background">
        <p className="mx-auto w-full max-w-4xl px-4 py-4 text-xs text-muted-foreground">
          Demonstration system. Documents signed here are not contracts of insurance.
        </p>
      </footer>
    </div>
  );
}
