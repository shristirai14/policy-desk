import "server-only";
import { prisma } from "@/lib/prisma";
import { runRating, type RateBandDef, type RateFactorDef, type RateStepDef, type RatingOutput } from "@/lib/rating/engine";
import { todayIso } from "@/lib/ua/conditions";
import { riskCount } from "@/lib/ua/engine";
import type { Packet } from "@/lib/ua/types";

const iso = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");

export async function loadRateProgram(manualId: number): Promise<{ steps: RateStepDef[]; factors: RateFactorDef[]; bands: RateBandDef[] }> {
  const [steps, factors, bands] = await Promise.all([
    prisma.rateStep.findMany({ where: { manualId }, orderBy: [{ rateOrder: "asc" }, { id: "asc" }] }),
    prisma.rateFactor.findMany({ where: { manualId } }),
    prisma.rateBand.findMany({ where: { manualId } }),
  ]);
  return {
    steps: steps.map((step) => ({
      rateOrder: step.rateOrder,
      fieldName: step.fieldName,
      description: step.description ?? "",
      rateMode: step.rateMode,
      rateParameters: step.rateParameters ?? "",
      rateConditions: step.rateConditions ?? "",
      rateApplyTo: step.rateApplyTo ?? "",
      scope: step.scope,
      coverageCode: step.coverageCode ?? "",
      startDate: iso(step.startDate),
      endDate: iso(step.endDate),
    })),
    factors: factors.map((row) => ({
      fieldName: row.fieldName,
      keys: [row.key1, row.key2, row.key3, row.key4, row.key5],
      effectiveDate: iso(row.effectiveDate),
      numericValue: row.numericValue === null ? null : Number(row.numericValue),
      stringValue: row.stringValue,
    })),
    bands: bands.map((row) => ({
      fieldName: row.fieldName,
      keys: [row.key1, row.key2, row.key3],
      effectiveDate: iso(row.effectiveDate),
      upTo: Number(row.upTo),
      numericValue: Number(row.numericValue),
    })),
  };
}

export async function rateForManual(manualId: number, packet: Packet): Promise<RatingOutput> {
  const program = await loadRateProgram(manualId);
  if (program.steps.length === 0) {
    const failed: Packet = { ...packet, ValidRating: "false", RatingError: "This product has no rating steps set up yet.", TotalPremium: "" };
    return { ok: false, error: failed.RatingError, total: 0, rows: [], flow: [], packet: failed };
  }
  return runRating({ ...program, packet, riskCount: riskCount(packet), rateDate: packet.EffectiveDate || todayIso() });
}

export async function rateAndStore(quoteId: number, manualId: number, packet: Packet) {
  const output = await rateForManual(manualId, packet);
  await prisma.$transaction([
    prisma.quoteRatingResult.deleteMany({ where: { quoteId } }),
    prisma.quoteRateFlow.deleteMany({ where: { quoteId } }),
    prisma.quoteRatingResult.createMany({
      data: output.rows.map((row) => ({
        quoteId,
        seq: row.seq,
        risk: row.risk,
        fieldName: row.fieldName,
        description: row.description,
        coverageCode: row.coverageCode || null,
        premiumAmount: row.premiumAmount,
        runningBase: row.runningBase,
      })),
    }),
    prisma.quoteRateFlow.createMany({
      data: output.flow.map((row) => ({
        quoteId,
        seq: row.seq,
        risk: row.risk,
        rateOrder: row.rateOrder,
        fieldName: row.fieldName,
        rateMode: row.rateMode,
        flowValue: row.flowValue,
        flowInfo: row.flowInfo,
        flowPremium: row.flowPremium,
      })),
    }),
  ]);
  return output;
}
