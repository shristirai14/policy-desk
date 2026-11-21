import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { isRole, type Role } from "@/lib/permissions";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function roleOf(session: { user: { role?: string | null } }): Role {
  return isRole(session.user.role) ? session.user.role : "agent";
}

export async function requireRole(...allowed: Role[]) {
  const session = await requireSession();
  if (!allowed.includes(roleOf(session))) redirect("/dashboard");
  return session;
}
