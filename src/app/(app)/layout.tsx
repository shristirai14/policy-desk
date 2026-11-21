import { AppHeader, PageTransition } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireSession, roleOf } from "@/lib/session";

export const instant = false;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const user = { name: session.user.name, email: session.user.email, role: roleOf(session) };

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <PageTransition>{children}</PageTransition>
      </SidebarInset>
    </SidebarProvider>
  );
}
