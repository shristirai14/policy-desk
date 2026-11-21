import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { formatCalendarDate } from "@/lib/status";
import { ManualRowActions } from "./manual-row-actions";
import { NewManualDialog } from "./new-manual-dialog";

export const metadata: Metadata = { title: "UA Builder" };
export const instant = false;

const STATUS: Record<string, { label: string; tone: "default" | "secondary" | "outline" }> = {
  A: { label: "Active", tone: "default" },
  D: { label: "Draft", tone: "secondary" },
  R: { label: "Retired", tone: "outline" },
};

const PRODUCTS: Record<string, string> = { PVTCAR: "Private car", TWOWHEELER: "Two-wheeler" };

export default async function BuilderPage() {
  await requireRole("admin");
  const manuals = await prisma.manual.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { views: true, pages: true, quotes: true } } },
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">UA Builder</h1>
          <p className="text-sm text-muted-foreground">
            A manual defines a product&apos;s quote form: its views, pages, sections and questions.
          </p>
        </div>
        <NewManualDialog />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Manual</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Pages</TableHead>
              <TableHead className="text-right">Quotes</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {manuals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No manuals yet. Create one to start building a quote form.
                </TableCell>
              </TableRow>
            ) : (
              manuals.map((manual) => {
                const status = STATUS[manual.status] ?? STATUS.D;
                return (
                  <TableRow key={manual.id}>
                    <TableCell>
                      <Link href={`/builder/${manual.id}`} className="font-medium underline-offset-4 hover:underline">
                        {manual.name}
                      </Link>
                    </TableCell>
                    <TableCell>{PRODUCTS[manual.policyTypeCode] ?? manual.policyTypeCode}</TableCell>
                    <TableCell>
                      <Badge variant={status.tone}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>{formatCalendarDate(manual.startDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{manual._count.views}</TableCell>
                    <TableCell className="text-right tabular-nums">{manual._count.pages}</TableCell>
                    <TableCell className="text-right tabular-nums">{manual._count.quotes}</TableCell>
                    <TableCell>
                      <ManualRowActions manualId={manual.id} name={manual.name} />
                    </TableCell>
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
