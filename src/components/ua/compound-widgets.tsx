"use client";

import { FormSelect } from "@/components/form-select";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/status";
import type { Packet, UAQuestion } from "@/lib/ua/types";
import { VEHICLE_CATALOG, findVariant } from "@/lib/ua/vehicle-catalog";
import { cn } from "@/lib/utils";


export type RatingView = {
  valid: boolean;
  error: string;
  total: number | null;
  rows: Array<{ risk: number; description: string; coverageCode: string; amount: number }>;
  flowHref?: string;
};

export type DetailControls = {
  count: number;
  max: number;
  editing: number | null;
  values: Packet;
  error?: string;
  locked: boolean;
  pending: boolean;
  onAdd: () => void;
  onEdit: (risk: number) => void;
  onDelete: (risk: number) => void;
};

export function VehiclePicker({
  id,
  value,
  disabled,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  value: string;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
  onChange: (code: string) => void;
}) {
  const current = findVariant(value);
  const makes = [...new Set(VEHICLE_CATALOG.map((item) => item.make))];
  const make = current?.make ?? (value.startsWith("make:") ? value.slice(5).split("|")[0] : "");
  const model = current?.model ?? (value.startsWith("make:") ? (value.slice(5).split("|")[1] ?? "") : "");
  const models = [...new Set(VEHICLE_CATALOG.filter((item) => item.make === make).map((item) => item.model))];
  const variants = VEHICLE_CATALOG.filter((item) => item.make === make && item.model === model);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <FormSelect
          id={id}
          size="lg"
          aria-label="Make"
          placeholder="Make"
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          value={make}
          onValueChange={(next) => onChange(next ? `make:${next}|` : "")}
          options={makes.map((item) => ({ value: item, label: item }))}
        />
        <FormSelect
          size="lg"
          aria-label="Model"
          placeholder="Model"
          disabled={disabled || !make}
          aria-invalid={invalid}
          value={model}
          onValueChange={(next) => onChange(`make:${make}|${next}`)}
          options={models.map((item) => ({ value: item, label: item }))}
        />
        <FormSelect
          size="lg"
          aria-label="Variant"
          placeholder="Variant"
          disabled={disabled || !model}
          aria-invalid={invalid}
          value={current?.code ?? ""}
          onValueChange={(next) => onChange(next || `make:${make}|${model}`)}
          options={variants.map((item) => ({ value: item.code, label: item.variant }))}
        />
      </div>
      {current ? (
        <p className="text-xs text-muted-foreground">
          {current.cubicCapacity} cc, {current.fuelType}, {current.seatingCapacity} seats, ex-showroom {formatMoney(current.exShowroomPrice)}
        </p>
      ) : null}
    </div>
  );
}

export function DetailList({ question, controls }: { question: UAQuestion; controls: DetailControls }) {
  const label = question.props.ItemLabel || "Item";
  const lower = label.toLowerCase();
  const fields = (question.props.SummaryFields ?? "")
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
  const busy = controls.pending || controls.editing !== null;
  const items = Array.from({ length: controls.count }, (_, index) => index + 1);

  return (
    <div className="col-span-12 flex flex-col gap-3">
      {question.text ? <p className="text-sm text-muted-foreground">{question.text}</p> : null}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No {lower} added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((risk) => {
            const summary = fields.map((field) => controls.values[`${field}_${risk}`]).filter(Boolean);
            return (
              <li
                key={risk}
                className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3", controls.editing === risk && "border-primary")}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {label} {risk}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{summary.length > 0 ? summary.join(" · ") : "Details not complete"}</p>
                </div>
                {controls.locked ? null : (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => controls.onEdit(risk)}>
                      <Pencil />
                      Edit
                    </Button>
                    <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => controls.onDelete(risk)}>
                      <Trash2 />
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {controls.error ? (
        <p id="NumberOfRisks-error" className="text-xs text-destructive">
          {controls.error}
        </p>
      ) : null}
      {controls.locked ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            name="NumberOfRisks"
            variant="outline"
            disabled={busy || controls.count >= controls.max}
            onClick={controls.onAdd}
          >
            <Plus />
            Add {lower}
          </Button>
          {controls.count >= controls.max ? (
            <span className="text-xs text-muted-foreground">
              A quote can have at most {controls.max} {lower}s.
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

const COVERAGE_LABELS: Record<string, string> = {
  OD: "Own damage",
  ADDON: "Add-on covers",
  TP: "Third party",
  PA: "Personal accident",
  TAX: "Taxes",
};

export function RatingTotals({ rating, vehicleLabel }: { rating: RatingView | undefined; vehicleLabel: (risk: number) => string }) {
  if (!rating || !rating.valid) {
    return (
      <div className="col-span-12 rounded-lg border border-dashed p-4 text-sm">
        <p className="font-medium">No premium yet</p>
        <p className="text-muted-foreground">{rating?.error || "The premium is calculated when this page opens. Use Recalculate after changing answers."}</p>
      </div>
    );
  }
  const risks = [...new Set(rating.rows.filter((row) => row.risk > 0).map((row) => row.risk))];
  const policyRows = rating.rows.filter((row) => row.risk === 0);
  const net = rating.rows.filter((row) => row.risk > 0).reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="col-span-12 flex flex-col gap-4">
      {risks.map((risk) => {
        const rows = rating.rows.filter((row) => row.risk === risk);
        const subtotal = rows.reduce((sum, row) => sum + row.amount, 0);
        return (
          <table key={risk} className="w-full text-sm">
            <caption className="pb-1 text-left font-medium">{vehicleLabel(risk)}</caption>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t">
                  <td className="py-1.5">{row.description}</td>
                  <td className="py-1.5 text-xs text-muted-foreground">{COVERAGE_LABELS[row.coverageCode] ?? row.coverageCode}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(row.amount)}</td>
                </tr>
              ))}
              <tr className="border-t font-medium">
                <td className="py-1.5" colSpan={2}>
                  Premium for this vehicle
                </td>
                <td className="py-1.5 text-right tabular-nums">{formatMoney(subtotal)}</td>
              </tr>
            </tbody>
          </table>
        );
      })}
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-t">
            <td className="py-1.5">Net premium</td>
            <td className="py-1.5 text-right tabular-nums">{formatMoney(net)}</td>
          </tr>
          {policyRows.map((row, index) => (
            <tr key={index} className="border-t">
              <td className="py-1.5">{row.description}</td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(row.amount)}</td>
            </tr>
          ))}
          <tr className="border-t text-base font-semibold">
            <td className="py-2">Total premium payable</td>
            <td className="py-2 text-right tabular-nums">{formatMoney(rating.total)}</td>
          </tr>
        </tbody>
      </table>
      {rating.flowHref ? (
        <Link href={rating.flowHref} className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline">
          See how this premium was calculated
        </Link>
      ) : null}
    </div>
  );
}
