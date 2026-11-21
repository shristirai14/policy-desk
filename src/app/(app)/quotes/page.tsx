import { FormSelect } from "@/components/form-select";
import { Plus, Search } from "lucide-react";
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
import { formatDate, formatMoney, QUOTE_STATUS, statusOf } from "@/lib/status";
import { quoteScope } from "@/lib/ua/pipeline";

export const metadata: Metadata = { title: "Search quotes" };
export const instant = false;


export default async function QuotesPage({ searchParams }: PageProps<"/quotes">) {
  const session = await requireSession();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" && params.status in QUOTE_STATUS ? params.status : "";

  const where: Prisma.QuoteWhereInput = {
    ...quoteScope({ userId: session.user.id, role: roleOf(session), agentId: null }),
    ...(status ? { statusCode: status } : { statusCode: { not: "X" } }),
    ...(q
      ? {
          OR: [
            { quoteNumber: { contains: q, mode: "insensitive" } },
            { applicantName: { contains: q, mode: "insensitive" } },
            { applicantMobile: { contains: q } },
            { applicantEmail: { contains: q, mode: "insensitive" } },
            { registrationNumber: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const quotes = await prisma.quote.findMany({
    where,
    include: { manual: { select: { name: true } }, agent: { select: { agentCode: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Search quotes</h1>
          <p className="text-sm text-muted-foreground">Find a quote by number, applicant, mobile, email or registration number.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/quotes/new" />}>
          <Plus />
          Create quote
        </Button>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-2">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Q000012, Sharma, MH12AB1234" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <FormSelect
            id="status"
            name="status"
            defaultValue={status}
            emptyLabel="All open"
            className="min-w-44"
            options={Object.entries(QUOTE_STATUS).map(([code, item]) => ({ value: code, label: item.label }))}
          />
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
              <TableHead>Quote</TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Premium</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {q || status ? "No quotes match this search." : "No quotes yet. Create one to get started."}
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((quote) => {
                const item = statusOf(quote.statusCode);
                return (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <Link href={`/quotes/${quote.id}`} className="font-medium underline-offset-4 hover:underline">
                        {quote.quoteNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {quote.applicantName ?? <span className="text-muted-foreground">Not entered</span>}
                      {quote.registrationNumber ? (
                        <span className="block text-xs text-muted-foreground">{quote.registrationNumber}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{quote.manual.name}</TableCell>
                    <TableCell>{quote.agent?.agentCode ?? ""}</TableCell>
                    <TableCell>
                      <Badge variant={item.tone}>{item.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {quote.ratingValid ? formatMoney(quote.totalPremium) : ""}
                    </TableCell>
                    <TableCell>{formatDate(quote.updatedAt)}</TableCell>
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
