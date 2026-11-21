import { FormSelect } from "@/components/form-select";
import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { rateForManual } from "@/lib/rating/rate-quote";
import { requireRole } from "@/lib/session";
import { formatCalendarDate, formatMoney } from "@/lib/status";
import { asPacket } from "@/lib/ua/pipeline";
import { cn } from "@/lib/utils";
import { DeleteRowButton, RateRowForms, StepForm, type StepValues } from "../rating-forms";

export const metadata: Metadata = { title: "Rating" };
export const instant = false;

const TABS = [
  { key: "steps", label: "Rating steps" },
  { key: "tables", label: "Rate tables" },
  { key: "test", label: "Test rate" },
];


const iso = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");
const ALWAYS = "1900-01-01";

export default async function RatingWorkspacePage({ params, searchParams }: PageProps<"/rating/[manualId]">) {
  await requireRole("admin");
  const { manualId: rawId } = await params;
  const query = await searchParams;
  const manualId = Number(rawId);
  const manual = Number.isInteger(manualId) ? await prisma.manual.findUnique({ where: { id: manualId } }) : null;
  if (!manual) notFound();
  const text = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  const tab = TABS.some((item) => item.key === text("tab")) ? text("tab") : "steps";
  const base = `/rating/${manualId}`;

  let body: React.ReactNode;

  if (tab === "steps") {
    const steps = await prisma.rateStep.findMany({ where: { manualId }, orderBy: [{ rateOrder: "asc" }, { id: "asc" }] });
    const stepParam = text("step");
    const editing = steps.find((step) => String(step.id) === stepParam);
    const blank: StepValues = {
      rateOrder: String((steps[steps.length - 1]?.rateOrder ?? 0) + 10),
      fieldName: "",
      description: "",
      rateMode: "SetVariable",
      rateParameters: "",
      rateConditions: "",
      rateApplyTo: "",
      scope: "RISK",
      coverageCode: "",
      startDate: "",
      endDate: "",
    };
    const initial: StepValues | null = editing
      ? {
          id: editing.id,
          rateOrder: String(editing.rateOrder),
          fieldName: editing.fieldName,
          description: editing.description ?? "",
          rateMode: editing.rateMode,
          rateParameters: editing.rateParameters ?? "",
          rateConditions: editing.rateConditions ?? "",
          rateApplyTo: editing.rateApplyTo ?? "",
          scope: editing.scope === "POLICY" ? "POLICY" : "RISK",
          coverageCode: editing.coverageCode ?? "",
          startDate: iso(editing.startDate),
          endDate: iso(editing.endDate),
        }
      : stepParam === "new"
        ? blank
        : null;

    body = (
      <>
        {initial ? (
          <StepForm key={stepParam} manualId={manualId} initial={initial} />
        ) : (
          <Button nativeButton={false} className="self-start" render={<Link href={`${base}?tab=steps&step=new`} />}>
            <Plus />
            Add step
          </Button>
        )}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Order</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Parameters</TableHead>
                <TableHead>Run only when</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead>Premium line</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No rating steps yet. Quotes on this manual cannot be rated until steps are added.
                  </TableCell>
                </TableRow>
              ) : (
                steps.map((step) => (
                  <TableRow key={step.id} className={cn(editing?.id === step.id && "bg-muted")}>
                    <TableCell className="text-right tabular-nums">{step.rateOrder}</TableCell>
                    <TableCell>
                      <Link href={`${base}?tab=steps&step=${step.id}`} className="font-medium underline-offset-4 hover:underline">
                        {step.fieldName}
                      </Link>
                      {step.rateApplyTo ? <span className="block text-xs text-muted-foreground">into {step.rateApplyTo}</span> : null}
                    </TableCell>
                    <TableCell>{step.rateMode}</TableCell>
                    <TableCell className="font-mono text-xs">{step.rateParameters}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-normal">{step.rateConditions}</TableCell>
                    <TableCell>{step.scope === "POLICY" ? "Per policy" : "Per vehicle"}</TableCell>
                    <TableCell className="whitespace-normal">
                      {step.coverageCode ? <Badge variant="outline">{step.coverageCode}</Badge> : null} {step.description}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </>
    );
  } else if (tab === "tables") {
    const [factors, bands] = await Promise.all([
      prisma.rateFactor.findMany({ where: { manualId }, orderBy: [{ fieldName: "asc" }, { key1: "asc" }, { key2: "asc" }, { key3: "asc" }, { effectiveDate: "asc" }] }),
      prisma.rateBand.findMany({ where: { manualId }, orderBy: [{ fieldName: "asc" }, { key1: "asc" }, { effectiveDate: "asc" }, { upTo: "asc" }] }),
    ]);
    const tables = new Map<string, { kind: "factor" | "band"; name: string; count: number }>();
    for (const row of factors) {
      const key = `factor:${row.fieldName}`;
      tables.set(key, { kind: "factor", name: row.fieldName, count: (tables.get(key)?.count ?? 0) + 1 });
    }
    for (const row of bands) {
      const key = `band:${row.fieldName}`;
      tables.set(key, { kind: "band", name: row.fieldName, count: (tables.get(key)?.count ?? 0) + 1 });
    }
    const kind = text("kind") === "band" ? "band" : "factor";
    const selectedName = text("table");
    const isNew = text("new") === "1";
    const rows = kind === "band" ? bands.filter((row) => row.fieldName === selectedName) : factors.filter((row) => row.fieldName === selectedName);
    const hasSelection = selectedName !== "" && rows.length > 0;

    body = (
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr] lg:items-start">
        <nav aria-label="Rate tables" className="flex flex-col gap-0.5 rounded-lg border p-2">
          {[...tables.values()].map((table) => {
            const active = hasSelection && table.kind === kind && table.name === selectedName;
            return (
              <Link
                key={`${table.kind}:${table.name}`}
                href={`${base}?tab=tables&kind=${table.kind}&table=${table.name}`}
                aria-current={active ? "true" : undefined}
                className={cn("flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted", active && "bg-muted font-medium")}
              >
                <span className="truncate">{table.name}</span>
                <span className="text-xs text-muted-foreground">
                  {table.kind === "band" ? "bands" : "factors"} {table.count}
                </span>
              </Link>
            );
          })}
          {tables.size === 0 ? <p className="px-2 py-1.5 text-sm text-muted-foreground">No rate tables yet.</p> : null}
          <Link href={`${base}?tab=tables&new=1&kind=factor`} className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline">
            + New factor table
          </Link>
          <Link href={`${base}?tab=tables&new=1&kind=band`} className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline">
            + New band table
          </Link>
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          {isNew ? (
            <RateRowForms key={`new-${kind}`} manualId={manualId} kind={kind} fieldName="" />
          ) : hasSelection ? (
            <>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{selectedName}</h2>
                <p className="text-sm text-muted-foreground">
                  {kind === "band"
                    ? "Band table: a StepRate step returns the value of the first row whose limit is at or above the amount."
                    : "Factor table: a LookupRate step returns the value of the row whose keys match its parameters."}
                </p>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key 1</TableHead>
                      <TableHead>Key 2</TableHead>
                      <TableHead>Key 3</TableHead>
                      {kind === "band" ? <TableHead className="text-right">Up to</TableHead> : null}
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Effective from</TableHead>
                      <TableHead className="w-10">
                        <span className="sr-only">Delete</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.key1 === "x" ? "" : row.key1}</TableCell>
                        <TableCell>{row.key2 === "x" ? "" : row.key2}</TableCell>
                        <TableCell>{row.key3 === "x" ? "" : row.key3}</TableCell>
                        {"upTo" in row ? <TableCell className="text-right tabular-nums">{row.upTo.toString()}</TableCell> : null}
                        <TableCell className="text-right tabular-nums">
                          {row.numericValue !== null ? row.numericValue.toString() : "stringValue" in row ? row.stringValue : ""}
                        </TableCell>
                        <TableCell>{iso(row.effectiveDate) === ALWAYS ? "Always" : formatCalendarDate(row.effectiveDate)}</TableCell>
                        <TableCell>
                          <DeleteRowButton manualId={manualId} kind={kind} id={row.id} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <RateRowForms key={`${kind}-${selectedName}`} manualId={manualId} kind={kind} fieldName={selectedName} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Choose a rate table on the left to see and edit its rows.</p>
          )}
        </div>
      </div>
    );
  } else {
    const quotes = await prisma.quote.findMany({
      where: { manualId, statusCode: { not: "X" } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, quoteNumber: true, applicantName: true, data: true },
    });
    const selected = quotes.find((quote) => String(quote.id) === text("quote"));
    const output = selected ? await rateForManual(manualId, asPacket(selected.data)) : null;

    body = (
      <>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value="test" />
          <div className="flex min-w-64 flex-col gap-2">
            <label htmlFor="test-quote" className="text-sm font-medium">
              Quote to rate
            </label>
            <FormSelect
              id="test-quote"
              name="quote"
              required
              placeholder="Select"
              defaultValue={selected ? String(selected.id) : ""}
              options={quotes.map((quote) => ({ value: String(quote.id), label: `${quote.quoteNumber} ${quote.applicantName ?? ""}`.trim() }))}
            />
          </div>
          <Button type="submit" variant="outline">
            Run rating
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          A test run uses the quote&apos;s current answers and the steps and tables as they are now. It does not change the quote.
        </p>
        {quotes.length === 0 ? (
          <Alert>
            <AlertDescription>No quotes exist on this manual yet. Create one to test the rating.</AlertDescription>
          </Alert>
        ) : null}
        {output && !output.ok ? (
          <Alert variant="destructive">
            <AlertDescription>{output.error}</AlertDescription>
          </Alert>
        ) : null}
        {output?.ok ? (
          <Card>
            <CardHeader>
              <CardTitle>Total premium {formatMoney(output.total)}</CardTitle>
              <CardDescription>{output.rows.length} premium line(s).</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Line</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Running total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {output.rows.map((row) => (
                    <TableRow key={row.seq}>
                      <TableCell>{row.risk === 0 ? "Policy" : row.risk}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell>{row.coverageCode}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.premiumAmount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.runningBase)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
        {output && output.flow.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Rating trace</CardTitle>
              <CardDescription>Every step that ran, in order. A step whose condition failed does not appear.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="text-right">Order</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Inputs</TableHead>
                    <TableHead className="text-right">Result</TableHead>
                    <TableHead className="text-right">Premium so far</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {output.flow.map((row) => (
                    <TableRow key={row.seq}>
                      <TableCell>{row.risk === 0 ? "Policy" : row.risk}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.rateOrder}</TableCell>
                      <TableCell>{row.fieldName}</TableCell>
                      <TableCell>{row.rateMode}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-normal">{row.flowInfo}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.flowValue}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.flowPremium)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div>
        <Link href="/rating" className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline">
          <ArrowLeft className="size-3.5" />
          All manuals
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Rating: {manual.name}</h1>
      </div>
      <nav aria-label="Rating sections" className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`${base}?tab=${item.key}`}
            aria-current={tab === item.key ? "page" : undefined}
            className={cn("rounded-lg px-3 py-1.5 text-sm hover:bg-muted", tab === item.key ? "bg-muted font-medium" : "text-muted-foreground")}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {body}
    </>
  );
}
