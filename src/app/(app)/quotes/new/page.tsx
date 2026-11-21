import { Bike, Car } from "lucide-react";
import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { createQuoteAction } from "../actions";

export const metadata: Metadata = { title: "Create quote" };
export const instant = false;

const PRODUCT_LABELS: Record<string, string> = { PVTCAR: "Private car", TWOWHEELER: "Two-wheeler" };

export default async function NewQuotePage({ searchParams }: PageProps<"/quotes/new">) {
  await requireSession();
  const params = await searchParams;
  const now = new Date();
  const manuals = await prisma.manual.findMany({
    where: {
      status: "A",
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gt: now } }],
      views: { some: {} },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create quote</h1>
        <p className="text-sm text-muted-foreground">Choose the product to quote. You can leave a quote and come back to it later.</p>
      </div>
      {params.error ? (
        <Alert variant="destructive">
          <AlertDescription>That product has no quote form set up for your role.</AlertDescription>
        </Alert>
      ) : null}
      {manuals.length === 0 ? (
        <Alert>
          <AlertDescription>No products are available yet. An administrator needs to set one up in the UA Builder.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {manuals.map((manual) => {
            const Icon = manual.policyTypeCode === "TWOWHEELER" ? Bike : Car;
            return (
              <Card key={manual.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="size-4" />
                    {manual.name}
                  </CardTitle>
                  <CardDescription>{PRODUCT_LABELS[manual.policyTypeCode] ?? manual.policyTypeCode}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={createQuoteAction}>
                    <input type="hidden" name="manualId" value={manual.id} />
                    <Button type="submit">Start quote</Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
