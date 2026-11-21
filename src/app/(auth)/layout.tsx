import { AuthHero } from "@/components/auth/auth-hero";
import { Brand } from "@/components/brand-mark";

export const instant = false;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-2">
      <AuthHero />
      <section className="flex min-w-0 flex-col px-4 py-6 sm:px-6 lg:px-10">
        <div className="flex h-8 items-center lg:invisible">
          <Brand />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[360px]">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Agent access only. Contact your administrator for an account.
        </p>
      </section>
    </main>
  );
}
