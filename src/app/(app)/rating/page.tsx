import type { Metadata } from "next";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Rating" };
export const instant = false;

export default async function RatingPage() {
  await requireRole("admin");
  const manuals = await prisma.manual.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { rateSteps: true, rateFactors: true, rateBands: true } } },
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rating</h1>
        <p className="text-sm text-muted-foreground">
          Each manual has its own rating steps and rate tables. Premiums are calculated by running the steps in order.
        </p>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Manual</TableHead>
              <TableHead className="text-right">Steps</TableHead>
              <TableHead className="text-right">Factor rows</TableHead>
              <TableHead className="text-right">Band rows</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {manuals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No manuals yet. Create one in the UA Builder first.
                </TableCell>
              </TableRow>
            ) : (
              manuals.map((manual) => (
                <TableRow key={manual.id}>
                  <TableCell>
                    <Link href={`/rating/${manual.id}`} className="font-medium underline-offset-4 hover:underline">
                      {manual.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{manual._count.rateSteps}</TableCell>
                  <TableCell className="text-right tabular-nums">{manual._count.rateFactors}</TableCell>
                  <TableCell className="text-right tabular-nums">{manual._count.rateBands}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
