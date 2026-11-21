import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { monthsBetween, roundHalfAway, runRating, type RatingOutput } from "@/lib/rating/engine";
import { PRIVATE_CAR_BANDS, PRIVATE_CAR_FACTORS, PRIVATE_CAR_STEPS } from "@/lib/rating/private-car-program";
import type { Packet } from "@/lib/ua/types";

const POLICY: Packet = {
  ProposerType: "IND",
  CoverType: "PACKAGE",
  EffectiveDate: "2026-11-13",
  NCBPercent: "0",
  ZeroDep: "N",
  EngineProtect: "N",
  RoadsideAssistance: "N",
  ReturnToInvoice: "N",
  VoluntaryDeductible: "0",
  PAOwnerDriver: "Y",
  PAPassengers: "0",
  PaidDriver: "N",
};

function vehicle(risk: number, fields: Record<string, string>): Packet {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [`${key}_${risk}`, value]));
}

function rate(packet: Packet, riskCount = 1): RatingOutput {
  return runRating({
    steps: PRIVATE_CAR_STEPS,
    factors: PRIVATE_CAR_FACTORS,
    bands: PRIVATE_CAR_BANDS,
    packet,
    riskCount,
    rateDate: packet.EffectiveDate ?? "2026-11-13",
  });
}

function amounts(output: RatingOutput, risk: number) {
  return Object.fromEntries(output.rows.filter((row) => row.risk === risk).map((row) => [row.fieldName, row.premiumAmount]));
}

const NEXON = { RegistrationDate: "2024-11-13", RTOZone: "A", CubicCapacity: "1199", ExShowroomPrice: "800000", SeatingCapacity: "5", AntiTheft: "N" };

describe("rating helpers", () => {
  it("rounds half away from zero", () => {
    assert.equal(roundHalfAway(2.5, 0), 3);
    assert.equal(roundHalfAway(-2.5, 0), -3);
    assert.equal(roundHalfAway(1.005, 2), 1.01);
    assert.equal(roundHalfAway(21011.2, 0), 21011);
  });

  it("counts completed months", () => {
    assert.equal(monthsBetween("2024-11-13", "2026-11-13"), 24);
    assert.equal(monthsBetween("2024-11-14", "2026-11-13"), 23);
    assert.equal(monthsBetween("2026-11-13", "2026-11-13"), 0);
    assert.equal(monthsBetween("", "2026-11-13"), 0);
  });
});

describe("private car program", () => {
  it("rates a plain package policy", () => {
    const output = rate({ ...POLICY, ...vehicle(1, NEXON) });
    assert.equal(output.ok, true);
    const idv = 800000 * 0.8;
    const od = Math.round(idv * 3.283 * 0.01);
    const net = od + 3416 + 375;
    const gst = Math.round(net * 0.18);
    assert.equal(output.packet.IDV_1, String(idv));
    assert.deepEqual(amounts(output, 1), { ODBasic: od, TPPremium: 3416, PAOwnerPremium: 375 });
    assert.deepEqual(amounts(output, 0), { GST: gst });
    assert.equal(output.total, net + gst);
    assert.equal(output.packet.NetPremium, String(net));
    assert.equal(output.packet.TotalPremium, String(net + gst));
    assert.equal(output.packet.RiskPremium_1, String(net));
    assert.equal(output.packet.ValidRating, "true");
  });

  it("applies discounts in order: anti-theft, voluntary deductible, then NCB on the net", () => {
    const output = rate({
      ...POLICY,
      NCBPercent: "25",
      VoluntaryDeductible: "5000",
      ...vehicle(1, { ...NEXON, AntiTheft: "Y" }),
    });
    const od = Math.round(640000 * 3.283 * 0.01);
    const antiTheft = -Math.min(Math.round(od * 0.025), 500);
    const volDed = -Math.min(Math.round(od * 0.25), 1500);
    const ncb = Math.round((od + antiTheft + volDed) * 25 * -0.01);
    assert.deepEqual(amounts(output, 1), {
      ODBasic: od,
      AntiTheftDisc: antiTheft,
      VolDedDisc: volDed,
      NCBDisc: ncb,
      TPPremium: 3416,
      PAOwnerPremium: 375,
    });
    const net = od + antiTheft + volDed + ncb + 3416 + 375;
    assert.equal(output.total, net + Math.round(net * 0.18));
  });

  it("adds add-ons and passenger cover for a large new vehicle in zone B", () => {
    const output = rate({
      ...POLICY,
      ZeroDep: "Y",
      EngineProtect: "Y",
      RoadsideAssistance: "Y",
      ReturnToInvoice: "Y",
      PAPassengers: "100000",
      PaidDriver: "Y",
      ...vehicle(1, { RegistrationDate: "2026-08-01", RTOZone: "B", CubicCapacity: "2393", ExShowroomPrice: "1999000", SeatingCapacity: "7", AntiTheft: "N" }),
    });
    const idv = Math.round(1999000 * 0.95);
    assert.equal(output.packet.IDV_1, String(idv));
    assert.deepEqual(amounts(output, 1), {
      ODBasic: Math.round(idv * 3.343 * 0.01),
      ZeroDepPremium: Math.round(idv * 0.4 * 0.01),
      EnginePremium: Math.round(idv * 0.15 * 0.01),
      RSAPremium: 199,
      RTIPremium: Math.round(idv * 0.3 * 0.01),
      TPPremium: 7897,
      PAOwnerPremium: 375,
      PAPassengerPremium: Math.round(100000 * 0.05 * 0.01 * 7),
      PaidDriverPremium: 50,
    });
  });

  it("charges only third party covers on a third-party-only policy", () => {
    const output = rate({ ...POLICY, CoverType: "TP", ZeroDep: "Y", ...vehicle(1, { ...NEXON, CubicCapacity: "998" }) });
    assert.deepEqual(amounts(output, 1), { TPPremium: 2094, PAOwnerPremium: 375 });
    assert.equal(output.total, 2469 + Math.round(2469 * 0.18));
  });

  it("rates each vehicle and charges owner-driver cover once", () => {
    const output = rate(
      {
        ...POLICY,
        ...vehicle(1, NEXON),
        ...vehicle(2, { RegistrationDate: "2019-01-10", RTOZone: "A", CubicCapacity: "998", ExShowroomPrice: "499000", SeatingCapacity: "5", AntiTheft: "N" }),
      },
      2,
    );
    const first = Math.round(640000 * 3.283 * 0.01) + 3416 + 375;
    const idvSecond = Math.round(499000 * 0.4);
    const second = Math.round(idvSecond * 3.283 * 0.01) + 2094;
    assert.equal(output.packet.IDV_2, String(idvSecond));
    assert.equal(output.packet.RiskPremium_1, String(first));
    assert.equal(output.packet.RiskPremium_2, String(second));
    assert.equal(amounts(output, 2).PAOwnerPremium, undefined);
    assert.equal(output.total, first + second + Math.round((first + second) * 0.18));
  });

  it("skips owner-driver cover for a company and return to invoice for an older vehicle", () => {
    const output = rate({ ...POLICY, ProposerType: "CORP", ReturnToInvoice: "Y", ...vehicle(1, { ...NEXON, RegistrationDate: "2022-01-01" }) });
    const row = amounts(output, 1);
    assert.equal(row.PAOwnerPremium, undefined);
    assert.equal(row.RTIPremium, undefined);
  });

  it("stops with a message when a vehicle is too old", () => {
    const output = rate({ ...POLICY, ...vehicle(1, { ...NEXON, RegistrationDate: "2010-01-01" }) });
    assert.equal(output.ok, false);
    assert.equal(output.error, "Vehicle 1: Vehicles older than 15 years cannot be quoted here.");
    assert.equal(output.packet.ValidRating, "false");
    assert.equal(output.rows.length, 0);
  });

  it("refuses to rate without a vehicle and reports unknown modes", () => {
    assert.equal(rate({ ...POLICY }, 0).error, "Add at least one vehicle before rating.");
    const output = runRating({
      steps: [{ ...PRIVATE_CAR_STEPS[0], rateMode: "Bogus" }],
      factors: [],
      bands: [],
      packet: { ...POLICY },
      riskCount: 1,
      rateDate: "2026-11-13",
    });
    assert.match(output.error, /unknown mode "Bogus"/);
  });

  it("records a flow row for each executed step and none for skipped ones", () => {
    const output = rate({ ...POLICY, ...vehicle(1, NEXON) });
    const fields = output.flow.map((row) => row.fieldName);
    assert.ok(fields.includes("ODRate"));
    assert.ok(!fields.includes("ZeroDepRate"));
    const od = output.flow.find((row) => row.fieldName === "ODRate");
    assert.equal(od?.flowValue, "3.283");
    assert.equal(od?.flowInfo, "RTOZone=A, CCBand=2, AgeBand=1");
  });

  it("uses the latest rate version on or before the rate date", () => {
    const factors = [...PRIVATE_CAR_FACTORS, { fieldName: "TPRate", keys: ["2"], effectiveDate: "2027-04-01", numericValue: 4000, stringValue: null }];
    const run = (rateDate: string) =>
      runRating({ steps: PRIVATE_CAR_STEPS, factors, bands: PRIVATE_CAR_BANDS, packet: { ...POLICY, EffectiveDate: rateDate, ...vehicle(1, { ...NEXON, RegistrationDate: "2026-01-01" }) }, riskCount: 1, rateDate });
    assert.equal(amounts(run("2026-11-13"), 1).TPPremium, 3416);
    assert.equal(amounts(run("2027-04-01"), 1).TPPremium, 4000);
  });
});
