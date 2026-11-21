import type { Metadata } from "next";
import { CircleCheck, FileText, ScrollText, Signature } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireSession, roleOf } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };
export const instant = false;

export default async function DashboardPage() {
  const session = await requireSession();
  const scope = roleOf(session) === "agent" ? { userId: session.user.id } : {};

  const [inProgress, inEsign, issued, policies] = await Promise.all([
    prisma.quote.count({ where: { ...scope, statusCode: "P" } }),
    prisma.quote.count({ where: { ...scope, statusCode: "B" } }),
    prisma.quote.count({ where: { ...scope, statusCode: "A" } }),
    prisma.policy.count({ where: { quote: scope } }),
  ]);

  const stats = [
    { label: "Quotes in progress", value: inProgress, hint: "Not yet submitted", icon: FileText },
    { label: "Out for e-sign", value: inEsign, hint: "Waiting on the insured", icon: Signature },
    { label: "Quotes approved", value: issued, hint: "Signed and paid", icon: CircleCheck },
    { label: "Policies issued", value: policies, hint: "Active and expired", icon: ScrollText },
  ];

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {session.user.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here is where your book stands today.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardAction>
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-primary">
                  <stat.icon className="size-4" />
                </span>
              </CardAction>
              <CardTitle className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{stat.hint}</CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
