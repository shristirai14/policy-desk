"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findNav } from "@/components/nav-items";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  const pathname = usePathname();
  const match = findNav(pathname);
  const onItemRoot = match ? pathname === match.item.href : false;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      {match ? (
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <li className="hidden sm:block">{match.group}</li>
            <li aria-hidden="true" className="hidden sm:block">
              <ChevronRight className="size-3.5" />
            </li>
            {onItemRoot ? (
              <li aria-current="page" className="truncate font-medium text-foreground">
                {match.item.label}
              </li>
            ) : (
              <>
                <li>
                  <Link href={match.item.href} className="transition-colors hover:text-foreground">
                    {match.item.label}
                  </Link>
                </li>
                <li aria-hidden="true">
                  <ChevronRight className="size-3.5" />
                </li>
                <li aria-current="page" className="font-medium text-foreground">
                  Details
                </li>
              </>
            )}
          </ol>
        </nav>
      ) : null}
      {pathname.startsWith("/quotes") ? null : (
        <Button nativeButton={false} size="sm" className="ml-auto" render={<Link href="/quotes/new" />}>
          <Plus data-icon="inline-start" />
          Create quote
        </Button>
      )}
    </header>
  );
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="stagger flex flex-1 flex-col gap-6 p-4 md:p-6">
      {children}
    </div>
  );
}
