"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { RATE_MODES } from "@/lib/rating/engine";
import { requireRole } from "@/lib/session";

export type RatingResult = { ok: true; message: string } | { ok: false; message: string };

const NUMERIC = /^-?\d+(\.\d+)?$/;
const ALWAYS = new Date("1900-01-01");

async function requireRatingAdmin(): Promise<void> {
  await requireRole("admin");
  throw new Error("Rating administration is disabled.");
}

function done(manualId: number, message: string): RatingResult {
  revalidatePath(`/rating/${manualId}`);
  return { ok: true, message };
}

function dateOr(value: string | undefined, fallback: Date | null) {
  const text = (value ?? "").trim();
  if (!text) return fallback;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

const stepSchema = z.object({
  manualId: z.number().int().positive(),
  id: z.number().int().positive().optional(),
  rateOrder: z.coerce.number().int().min(0).max(999999),
  fieldName: z.string().trim().min(1, "A field name is required.").max(50).regex(/^[A-Za-z][A-Za-z0-9]*$/, "Field names use letters and digits only."),
  description: z.string().trim().max(255),
  rateMode: z.string().trim().min(1).max(50),
  rateParameters: z.string().trim().max(255),
  rateConditions: z.string().trim().max(255),
  rateApplyTo: z.string().trim().max(50),
  scope: z.enum(["RISK", "POLICY"]),
  coverageCode: z.string().trim().max(10),
  startDate: z.string().trim().max(10),
  endDate: z.string().trim().max(10),
});

export async function saveStepAction(input: z.input<typeof stepSchema>): Promise<RatingResult> {
  await requireRatingAdmin();
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const step = parsed.data;
  const modeName = step.rateMode.split(",")[0].trim().toLowerCase();
  if (!RATE_MODES.some((mode) => mode.toLowerCase() === modeName)) return { ok: false, message: `"${step.rateMode}" is not a rate mode.` };

  const data = {
    rateOrder: step.rateOrder,
    fieldName: step.fieldName,
    description: step.description || null,
    rateMode: step.rateMode,
    rateParameters: step.rateParameters || null,
    rateConditions: step.rateConditions || null,
    rateApplyTo: step.rateApplyTo || null,
    scope: step.scope,
    coverageCode: step.coverageCode || null,
    startDate: dateOr(step.startDate, null),
    endDate: dateOr(step.endDate, null),
  };
  if (step.id) await prisma.rateStep.update({ where: { id: step.id }, data });
  else await prisma.rateStep.create({ data: { ...data, manualId: step.manualId } });
  return done(step.manualId, "Step saved. Existing quotes keep their premium until they are rated again.");
}

export async function deleteStepAction(manualId: number, id: number): Promise<RatingResult> {
  await requireRatingAdmin();
  await prisma.rateStep.delete({ where: { id } });
  return done(manualId, "Step deleted.");
}

const rowSchema = z.object({
  manualId: z.number().int().positive(),
  kind: z.enum(["factor", "band"]),
  fieldName: z.string().trim().min(1, "A table name is required.").max(50).regex(/^[A-Za-z][A-Za-z0-9]*$/, "Table names use letters and digits only."),
  key1: z.string().trim().max(50),
  key2: z.string().trim().max(50),
  key3: z.string().trim().max(50),
  upTo: z.string().trim().max(20),
  value: z.string().trim().min(1, "A value is required.").max(50),
  effectiveDate: z.string().trim().max(10),
});

export async function addRateRowAction(input: z.input<typeof rowSchema>): Promise<RatingResult> {
  await requireRatingAdmin();
  const parsed = rowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const row = parsed.data;
  const keys = { key1: row.key1 || "x", key2: row.key2 || "x", key3: row.key3 || "x" };
  const effectiveDate = dateOr(row.effectiveDate, ALWAYS) ?? ALWAYS;

  if (row.kind === "band") {
    if (!NUMERIC.test(row.upTo) || !NUMERIC.test(row.value)) return { ok: false, message: "Band rows need a numeric 'up to' and value." };
    await prisma.rateBand.create({
      data: { manualId: row.manualId, fieldName: row.fieldName, ...keys, effectiveDate, upTo: Number(row.upTo), numericValue: Number(row.value) },
    });
  } else {
    const numeric = NUMERIC.test(row.value);
    await prisma.rateFactor.create({
      data: {
        manualId: row.manualId,
        fieldName: row.fieldName,
        ...keys,
        effectiveDate,
        numericValue: numeric ? Number(row.value) : null,
        stringValue: numeric ? null : row.value,
      },
    });
  }
  return done(row.manualId, "Row added.");
}

export async function deleteRateRowAction(manualId: number, kind: "factor" | "band", id: number): Promise<RatingResult> {
  await requireRatingAdmin();
  if (kind === "band") await prisma.rateBand.delete({ where: { id } });
  else await prisma.rateFactor.delete({ where: { id } });
  return done(manualId, "Row deleted.");
}

const importSchema = z.object({
  manualId: z.number().int().positive(),
  kind: z.enum(["factor", "band"]),
  fieldName: z.string().trim().min(1).max(50).regex(/^[A-Za-z][A-Za-z0-9]*$/, "Table names use letters and digits only."),
  csv: z.string().max(200000),
  replace: z.boolean(),
});

export async function importRateRowsAction(input: z.input<typeof importSchema>): Promise<RatingResult> {
  await requireRatingAdmin();
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { manualId, kind, fieldName, csv, replace } = parsed.data;
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (lines.length === 0) return { ok: false, message: "Paste at least one row." };
  if (lines.length > 5000) return { ok: false, message: "Import at most 5,000 rows at a time." };

  const factors: Array<{ key1: string; key2: string; key3: string; numericValue: number | null; stringValue: string | null }> = [];
  const bands: Array<{ key1: string; key2: string; key3: string; upTo: number; numericValue: number }> = [];
  for (const [index, line] of lines.entries()) {
    const cells = line.split(",").map((cell) => cell.trim());
    const where = `Row ${index + 1}`;
    if (kind === "band") {
      if (cells.length < 2 || cells.length > 5) return { ok: false, message: `${where}: expected keys (up to 3), then up-to, then value.` };
      const value = cells[cells.length - 1];
      const upTo = cells[cells.length - 2];
      if (!NUMERIC.test(value) || !NUMERIC.test(upTo)) return { ok: false, message: `${where}: up-to and value must be numbers.` };
      const keys = cells.slice(0, -2);
      bands.push({ key1: keys[0] || "x", key2: keys[1] || "x", key3: keys[2] || "x", upTo: Number(upTo), numericValue: Number(value) });
    } else {
      if (cells.length < 1 || cells.length > 4) return { ok: false, message: `${where}: expected keys (up to 3), then value.` };
      const value = cells[cells.length - 1];
      if (!value) return { ok: false, message: `${where}: the value is empty.` };
      const keys = cells.slice(0, -1);
      const numeric = NUMERIC.test(value);
      factors.push({ key1: keys[0] || "x", key2: keys[1] || "x", key3: keys[2] || "x", numericValue: numeric ? Number(value) : null, stringValue: numeric ? null : value });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (kind === "band") {
      if (replace) await tx.rateBand.deleteMany({ where: { manualId, fieldName } });
      await tx.rateBand.createMany({ data: bands.map((row) => ({ ...row, manualId, fieldName, effectiveDate: ALWAYS })) });
    } else {
      if (replace) await tx.rateFactor.deleteMany({ where: { manualId, fieldName } });
      await tx.rateFactor.createMany({ data: factors.map((row) => ({ ...row, manualId, fieldName, effectiveDate: ALWAYS })) });
    }
  });
  return done(manualId, `${lines.length} row(s) imported into ${fieldName}.`);
}
