import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession, roleOf } from "@/lib/session";
import { AuthenticatorCard } from "./authenticator-card";
import { ChangePasswordCard } from "./change-password-card";

export const metadata: Metadata = { title: "Account and security" };
export const instant = false;

export default async function AccountPage() {
  const session = await requireSession();
  const totp = await prisma.twoFactor.findFirst({
    where: { userId: session.user.id, NOT: { verified: false } },
    select: { id: true },
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account and security</h1>
        <p className="text-sm text-muted-foreground">Your profile, password and sign-in verification.</p>
      </div>
      <div className="grid max-w-3xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Ask an administrator to change these details.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{session.user.name}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{session.user.email}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd>{ROLE_LABELS[roleOf(session)]}</dd>
            </dl>
          </CardContent>
        </Card>
        <ChangePasswordCard />
        <AuthenticatorCard enabled={Boolean(totp)} />
      </div>
    </>
  );
}
