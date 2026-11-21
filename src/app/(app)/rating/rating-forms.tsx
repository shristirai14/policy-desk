"use client";

import { FormSelect } from "@/components/form-select";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RATE_MODES } from "@/lib/rating/engine";
import { addRateRowAction, deleteRateRowAction, deleteStepAction, importRateRowsAction, saveStepAction, type RatingResult } from "./actions";


const TEXTAREA_CLASS =
  "min-h-32 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function useRatingAction(after?: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function run(action: () => Promise<RatingResult>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(result.message);
      after?.();
      router.refresh();
    });
  }
  return { pending, error, run };
}

export type StepValues = {
  id?: number;
  rateOrder: string;
  fieldName: string;
  description: string;
  rateMode: string;
  rateParameters: string;
  rateConditions: string;
  rateApplyTo: string;
  scope: "RISK" | "POLICY";
  coverageCode: string;
  startDate: string;
  endDate: string;
};

function Field({ id, label, help, wide, children }: { id: string; label: string; help?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}

export function StepForm({ manualId, initial }: { manualId: number; initial: StepValues }) {
  const router = useRouter();
  const close = () => router.push(`/rating/${manualId}?tab=steps`);
  const { pending, error, run } = useRatingAction(close);
  const [step, setStep] = useState(initial);
  const set = (key: keyof StepValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setStep((current) => ({ ...current, [key]: event.target.value }));
  const [modeName, decimals = ""] = step.rateMode.split(",");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initial.id ? `Edit step ${initial.rateOrder}: ${initial.fieldName}` : "New step"}</CardTitle>
        <CardDescription>Steps run in order for each vehicle; policy steps run once after all vehicles.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => saveStepAction({ ...step, manualId }));
          }}
        >
          {error ? (
            <Alert variant="destructive" className="sm:col-span-2 xl:col-span-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Field id="step-order" label="Order">
            <Input id="step-order" inputMode="numeric" required value={step.rateOrder} onChange={set("rateOrder")} />
          </Field>
          <Field id="step-field" label="Field name" help="The variable this step sets, or the rate table it reads.">
            <Input id="step-field" required value={step.fieldName} onChange={set("fieldName")} />
          </Field>
          <Field id="step-mode" label="Mode">
            <FormSelect
              id="step-mode"
              placeholder="Select"
              value={RATE_MODES.find((mode) => mode.toLowerCase() === modeName.trim().toLowerCase()) ?? ""}
              onValueChange={(next) => setStep((current) => ({ ...current, rateMode: decimals ? `${next},${decimals}` : next }))}
              options={RATE_MODES.map((mode) => ({ value: mode, label: mode }))}
            />
          </Field>
          <Field id="step-decimals" label="Round to decimals" help="Empty means no rounding.">
            <Input
              id="step-decimals"
              inputMode="numeric"
              value={decimals}
              onChange={(event) =>
                setStep((current) => ({
                  ...current,
                  rateMode: event.target.value.trim() ? `${modeName},${event.target.value.trim()}` : modeName,
                }))
              }
            />
          </Field>
          <Field id="step-params" label="Parameters" help="Numbers, 'text', field names or variables, separated by commas." wide>
            <Input id="step-params" value={step.rateParameters} onChange={set("rateParameters")} />
          </Field>
          <Field id="step-conditions" label="Run only when" help="For example CoverType,=,PACKAGE;ZeroDep,=,Y" wide>
            <Input id="step-conditions" value={step.rateConditions} onChange={set("rateConditions")} />
          </Field>
          <Field id="step-apply" label="Store result in" help="Defaults to the field name.">
            <Input id="step-apply" value={step.rateApplyTo} onChange={set("rateApplyTo")} />
          </Field>
          <Field id="step-scope" label="Runs">
            <FormSelect
              id="step-scope"
              value={step.scope}
              onValueChange={(next) => setStep((current) => ({ ...current, scope: next === "POLICY" ? "POLICY" : "RISK" }))}
              options={[
                { value: "RISK", label: "Once per vehicle" },
                { value: "POLICY", label: "Once per policy" },
              ]}
            />
          </Field>
          <Field id="step-coverage" label="Coverage code" help="Groups premium lines: OD, ADDON, TP, PA, TAX.">
            <Input id="step-coverage" value={step.coverageCode} onChange={set("coverageCode")} />
          </Field>
          <Field id="step-description" label="Description" help="Shown on the premium breakup.">
            <Input id="step-description" value={step.description} onChange={set("description")} />
          </Field>
          <Field id="step-start" label="Effective from">
            <Input id="step-start" type="date" value={step.startDate} onChange={set("startDate")} />
          </Field>
          <Field id="step-end" label="Effective until">
            <Input id="step-end" type="date" value={step.endDate} onChange={set("endDate")} />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save step"}
            </Button>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            {initial.id ? (
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (window.confirm("Delete this rating step?")) run(() => deleteStepAction(manualId, initial.id!));
                }}
              >
                <Trash2 />
                Delete
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function DeleteRowButton({ manualId, kind, id }: { manualId: number; kind: "factor" | "band"; id: number }) {
  const { pending, run } = useRatingAction();
  return (
    <Button type="button" variant="ghost" size="icon-sm" disabled={pending} onClick={() => run(() => deleteRateRowAction(manualId, kind, id))}>
      <Trash2 />
      <span className="sr-only">Delete row</span>
    </Button>
  );
}

export function RateRowForms({ manualId, kind, fieldName }: { manualId: number; kind: "factor" | "band"; fieldName: string }) {
  const [row, setRow] = useState({ fieldName, key1: "", key2: "", key3: "", upTo: "", value: "", effectiveDate: "" });
  const [csv, setCsv] = useState("");
  const [replace, setReplace] = useState(false);
  const add = useRatingAction(() => setRow((current) => ({ ...current, key1: "", key2: "", key3: "", upTo: "", value: "" })));
  const importer = useRatingAction(() => setCsv(""));
  const set = (key: keyof typeof row) => (event: React.ChangeEvent<HTMLInputElement>) => setRow((current) => ({ ...current, [key]: event.target.value }));
  const isNew = fieldName === "";

  return (
    <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
      <Card>
        <CardHeader>
          <CardTitle>{isNew ? "New table" : "Add a row"}</CardTitle>
          <CardDescription>
            {kind === "band"
              ? "A band row applies to amounts up to and including its limit."
              : "A factor row is found by its keys. Leave unused keys empty."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              add.run(() => addRateRowAction({ ...row, manualId, kind }));
            }}
          >
            {add.error ? (
              <Alert variant="destructive" className="sm:col-span-3">
                <AlertDescription>{add.error}</AlertDescription>
              </Alert>
            ) : null}
            {isNew ? (
              <Field id="row-table" label="Table name">
                <Input id="row-table" required value={row.fieldName} onChange={set("fieldName")} />
              </Field>
            ) : null}
            <Field id="row-key1" label="Key 1">
              <Input id="row-key1" value={row.key1} onChange={set("key1")} />
            </Field>
            <Field id="row-key2" label="Key 2">
              <Input id="row-key2" value={row.key2} onChange={set("key2")} />
            </Field>
            <Field id="row-key3" label="Key 3">
              <Input id="row-key3" value={row.key3} onChange={set("key3")} />
            </Field>
            {kind === "band" ? (
              <Field id="row-upto" label="Up to">
                <Input id="row-upto" inputMode="decimal" required value={row.upTo} onChange={set("upTo")} />
              </Field>
            ) : null}
            <Field id="row-value" label="Value">
              <Input id="row-value" required value={row.value} onChange={set("value")} />
            </Field>
            <Field id="row-date" label="Effective from" help="Empty means always.">
              <Input id="row-date" type="date" value={row.effectiveDate} onChange={set("effectiveDate")} />
            </Field>
            <Button type="submit" className="justify-self-start sm:col-span-3" disabled={add.pending}>
              {add.pending ? "Adding..." : "Add row"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isNew ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Import rows</CardTitle>
            <CardDescription>
              {kind === "band" ? "One row per line: keys (optional), up-to, value. Example: 1000,1" : "One row per line: keys, then value. Example: A,1,1,3.127"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (replace && !window.confirm(`Replace every row of ${fieldName} with the pasted rows?`)) return;
                importer.run(() => importRateRowsAction({ manualId, kind, fieldName, csv, replace }));
              }}
            >
              {importer.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{importer.error}</AlertDescription>
                </Alert>
              ) : null}
              <label htmlFor="import-csv" className="sr-only">
                Rows to import
              </label>
              <textarea id="import-csv" className={TEXTAREA_CLASS} required value={csv} onChange={(event) => setCsv(event.target.value)} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={replace} onChange={(event) => setReplace(event.target.checked)} />
                Replace the existing rows of this table
              </label>
              <Button type="submit" variant="outline" className="self-start" disabled={importer.pending}>
                {importer.pending ? "Importing..." : "Import"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
