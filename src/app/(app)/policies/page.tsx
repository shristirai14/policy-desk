import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, roleOf } from "@/lib/session";
import { formatCalendarDate, formatMoney } from "@/lib/status";
import { quoteScope } from "@/lib/ua/pipeline";

export const metadata: Metadata = { title: "Policies" };
export const instant = false;

export default async function PoliciesPage({ searchParams }: PageProps<"/policies">) {
  const session = await requireSession();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const quoteWhere: Prisma.QuoteWhereInput = quoteScope({ userId: session.user.id, role: roleOf(session), agentId: null });
  const where: Prisma.PolicyWhereInput = {
    quote: quoteWhere,
    ...(q
      ? {
          OR: [
            { policyNumber: { contains: q, mode: "insensitive" } },
            { quote: { applicantName: { contains: q, mode: "insensitive" } } },
            { quote: { registrationNumber: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const policies = await prisma.policy.findMany({
    where,
    include: { quote: { select: { id: true, applicantName: true, registrationNumber: true, manual: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const today = new Date();

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
        <p className="text-sm text-muted-foreground">Policies are issued when a quote is paid and signed.</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-2">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Policy number, insured or registration number" />
        </div>
        <Button type="submit" variant="outline">
          <Search />
          Search
        </Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy</TableHead>
              <TableHead>Insured</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Premium</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {q ? "No policies match this search." : "No policies have been issued yet."}
                </TableCell>
              </TableRow>
            ) : (
              policies.map((policy) => {
                const expired = policy.expirationDate < today;
                return (
                  <TableRow key={policy.id}>
                    <TableCell>
                      <Link href={`/policies/${policy.id}`} className="font-medium underline-offset-4 hover:underline">
                        {policy.policyNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {policy.quote.applicantName}
                      {policy.quote.registrationNumber ? (
                        <span className="block text-xs text-muted-foreground">{policy.quote.registrationNumber}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{policy.quote.manual.name}</TableCell>
                    <TableCell>
                      {formatCalendarDate(policy.effectiveDate)} to {formatCalendarDate(policy.expirationDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={expired ? "outline" : "success"}>{expired ? "Expired" : "Active"}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(policy.totalPremium)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
