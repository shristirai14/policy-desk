import { evaluateCondition, type ConditionContext } from "@/lib/ua/conditions";
import { getValue } from "@/lib/ua/packet";
import type { Packet } from "@/lib/ua/types";

export type RateStepDef = {
  rateOrder: number;
  fieldName: string;
  description: string;
  rateMode: string;
  rateParameters: string;
  rateConditions: string;
  rateApplyTo: string;
  scope: string;
  coverageCode: string;
  startDate: string;
  endDate: string;
};

export type RateFactorDef = {
  fieldName: string;
  keys: string[];
  effectiveDate: string;
  numericValue: number | null;
  stringValue: string | null;
};

export type RateBandDef = {
  fieldName: string;
  keys: string[];
  effectiveDate: string;
  upTo: number;
  numericValue: number;
};

export type RatingInput = {
  steps: RateStepDef[];
  factors: RateFactorDef[];
  bands: RateBandDef[];
  packet: Packet;
  riskCount: number;
  rateDate: string;
};

export type RatingRow = {
  seq: number;
  risk: number;
  fieldName: string;
  description: string;
  coverageCode: string;
  premiumAmount: number;
  runningBase: number;
};

export type FlowRow = {
  seq: number;
  risk: number;
  rateOrder: number;
  fieldName: string;
  rateMode: string;
  flowValue: string;
  flowInfo: string;
  flowPremium: number;
};

export type RatingOutput = {
  ok: boolean;
  error: string;
  total: number;
  rows: RatingRow[];
  flow: FlowRow[];
  packet: Packet;
};

export const RATE_MODES = [
  "SetVariable",
  "AssignField",
  "Add",
  "Subtract",
  "Multiply",
  "Divide",
  "Maximum",
  "Minimum",
  "Floor",
  "Ceiling",
  "MonthsDifference",
  "LookupRate",
  "LookupString",
  "StepRate",
  "AddToBase",
  "AddTax",
  "RateError",
];

const NUMERIC = /^-?\d+(\.\d+)?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

export function roundHalfAway(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor + 1e-9)) / factor;
}

export function monthsBetween(from: string, to: string) {
  const a = ISO_DATE.exec(from);
  const b = ISO_DATE.exec(to);
  if (!a || !b) return 0;
  const months = (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2])) - (Number(b[3]) < Number(a[3]) ? 1 : 0);
  return Math.max(0, months);
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number) {
  return String(Number(value.toFixed(6)));
}

function keysMatch(rowKeys: string[], wanted: string[]) {
  return wanted.every((key, index) => (rowKeys[index] ?? "x").toLowerCase() === key.toLowerCase());
}

type State = { risk: number; vars: Map<string, string>; base: number };

export function runRating(input: RatingInput): RatingOutput {
  const packet: Packet = { ...input.packet };
  const rows: RatingRow[] = [];
  const flow: FlowRow[] = [];
  const policyVars = new Map<string, string>();
  let total = 0;

  const fail = (error: string): RatingOutput => {
    packet.ValidRating = "false";
    packet.RatingError = error;
    packet.TotalPremium = "";
    return { ok: false, error, total: 0, rows: [], flow, packet };
  };

  if (input.riskCount < 1) return fail("Add at least one vehicle before rating.");

  const active = input.steps
    .filter((step) => (!step.startDate || step.startDate <= input.rateDate) && (!step.endDate || step.endDate > input.rateDate))
    .sort((a, b) => a.rateOrder - b.rateOrder);

  const resolve = (raw: string, state: State): string => {
    const name = raw.trim();
    if (name === "") return "";
    if (NUMERIC.test(name)) return name;
    if (name.length >= 2 && name.startsWith("'") && name.endsWith("'")) return name.slice(1, -1);
    const lower = name.toLowerCase();
    if (lower === "!totalpremium") return formatNumber(state.risk === 0 ? state.base : total + state.base);
    if (lower === "!basepremium") return formatNumber(state.base);
    if (lower === "!risk") return String(state.risk);
    if (lower === "!riskcount") return String(input.riskCount);
    if (name.startsWith("-")) {
      const inner = resolve(name.slice(1), state);
      return NUMERIC.test(inner) ? formatNumber(-Number(inner)) : inner;
    }
    const variable = state.vars.get(lower) ?? policyVars.get(lower);
    if (variable !== undefined) return variable;
    if (state.risk > 0) {
      const riskValue = getValue(packet, `${name}_${state.risk}`);
      if (riskValue !== "") return riskValue;
    }
    return getValue(packet, name);
  };

  const findFactor = (table: string, keys: string[]) => {
    let best: RateFactorDef | null = null;
    for (const row of input.factors) {
      if (row.fieldName.toLowerCase() !== table.toLowerCase() || row.effectiveDate > input.rateDate) continue;
      if (!keysMatch(row.keys, keys)) continue;
      if (!best || row.effectiveDate > best.effectiveDate) best = row;
    }
    return best;
  };

  const findBand = (table: string, amount: number, keys: string[]) => {
    const candidates = input.bands.filter(
      (row) => row.fieldName.toLowerCase() === table.toLowerCase() && row.effectiveDate <= input.rateDate && keysMatch(row.keys, keys),
    );
    if (candidates.length === 0) return null;
    const version = candidates.reduce((latest, row) => (row.effectiveDate > latest ? row.effectiveDate : latest), "");
    const sorted = candidates.filter((row) => row.effectiveDate === version).sort((a, b) => a.upTo - b.upTo);
    return sorted.find((row) => amount <= row.upTo) ?? sorted[sorted.length - 1];
  };

  const execute = (steps: RateStepDef[], state: State): string => {
    const ctx: ConditionContext = { get: (name) => resolve(name, state), today: input.rateDate };
    for (const step of steps) {
      if (step.rateConditions && !evaluateCondition(step.rateConditions, ctx)) continue;
      const [modeName = "", decimalsText] = step.rateMode.split(",").map((part) => part.trim());
      const decimals = decimalsText !== undefined && NUMERIC.test(decimalsText) ? Number(decimalsText) : null;
      const rawParams = step.rateParameters ? step.rateParameters.split(",").map((part) => part.trim()) : [];
      const params = rawParams.map((param) => resolve(param, state));
      const numbers = params.map(toNumber);
      const target = (step.rateApplyTo || step.fieldName).toLowerCase();
      const finish = (value: number) => (decimals === null ? value : roundHalfAway(value, decimals));
      let value = "";

      switch (modeName.toLowerCase()) {
        case "setvariable":
          value = params[0] ?? "";
          state.vars.set(target, value);
          break;
        case "assignfield": {
          value = params[0] ?? "";
          const key = state.risk > 0 ? `${step.fieldName}_${state.risk}` : step.fieldName;
          packet[key] = value;
          break;
        }
        case "add":
          value = formatNumber(finish(numbers.reduce((sum, item) => sum + item, 0)));
          state.vars.set(target, value);
          break;
        case "subtract":
          value = formatNumber(finish(numbers.slice(1).reduce((result, item) => result - item, numbers[0] ?? 0)));
          state.vars.set(target, value);
          break;
        case "multiply":
          value = formatNumber(finish(numbers.length === 0 ? 0 : numbers.reduce((product, item) => product * item, 1)));
          state.vars.set(target, value);
          break;
        case "divide":
          value = formatNumber(finish(numbers[1] ? (numbers[0] ?? 0) / numbers[1] : 0));
          state.vars.set(target, value);
          break;
        case "maximum":
          value = formatNumber(finish(numbers.length === 0 ? 0 : Math.max(...numbers)));
          state.vars.set(target, value);
          break;
        case "minimum":
          value = formatNumber(finish(numbers.length === 0 ? 0 : Math.min(...numbers)));
          state.vars.set(target, value);
          break;
        case "floor":
          value = formatNumber(Math.floor((numbers[0] ?? 0) + 1e-9));
          state.vars.set(target, value);
          break;
        case "ceiling":
          value = formatNumber(Math.ceil((numbers[0] ?? 0) - 1e-9));
          state.vars.set(target, value);
          break;
        case "monthsdifference":
          value = String(monthsBetween(params[0] ?? "", params[1] ?? ""));
          state.vars.set(target, value);
          break;
        case "lookuprate": {
          const row = findFactor(step.fieldName, params);
          value = formatNumber(finish(row?.numericValue ?? 0));
          state.vars.set(target, value);
          break;
        }
        case "lookupstring": {
          const row = findFactor(step.fieldName, params);
          value = row?.stringValue ?? "";
          state.vars.set(target, value);
          break;
        }
        case "steprate": {
          const row = findBand(step.fieldName, numbers[0] ?? 0, params.slice(1));
          value = formatNumber(finish(row?.numericValue ?? 0));
          state.vars.set(target, value);
          break;
        }
        case "addtobase":
        case "addtax": {
          const amount =
            modeName.toLowerCase() === "addtax"
              ? finish((state.base * (numbers[0] ?? 0)) / 100)
              : finish(numbers.reduce((sum, item) => sum + item, 0));
          state.base += amount;
          value = formatNumber(amount);
          if (amount !== 0) {
            rows.push({
              seq: rows.length + 1,
              risk: state.risk,
              fieldName: step.fieldName,
              description: step.description || step.fieldName,
              coverageCode: step.coverageCode,
              premiumAmount: amount,
              runningBase: state.base,
            });
          }
          break;
        }
        case "rateerror": {
          const message = rawParams[0]?.replace(/^'|'$/g, "") || step.description || "This quote cannot be rated.";
          flow.push({
            seq: flow.length + 1,
            risk: state.risk,
            rateOrder: step.rateOrder,
            fieldName: step.fieldName,
            rateMode: step.rateMode,
            flowValue: "ERROR",
            flowInfo: message,
            flowPremium: state.base,
          });
          return state.risk > 0 ? `Vehicle ${state.risk}: ${message}` : message;
        }
        default:
          return `Rate step ${step.rateOrder} (${step.fieldName}) uses the unknown mode "${modeName}".`;
      }

      flow.push({
        seq: flow.length + 1,
        risk: state.risk,
        rateOrder: step.rateOrder,
        fieldName: step.fieldName,
        rateMode: step.rateMode,
        flowValue: value.slice(0, 50),
        flowInfo: rawParams
          .map((param, index) => (param === params[index] ? param : `${param}=${params[index]}`))
          .join(", ")
          .slice(0, 255),
        flowPremium: state.base,
      });
    }
    return "";
  };

  const riskSteps = active.filter((step) => step.scope !== "POLICY");
  const policySteps = active.filter((step) => step.scope === "POLICY");

  for (let risk = 1; risk <= input.riskCount; risk += 1) {
    const state: State = { risk, vars: new Map(), base: 0 };
    const error = execute(riskSteps, state);
    if (error) return fail(error);
    total += state.base;
    policyVars.set(`riskpremium_${risk}`, formatNumber(state.base));
  }

  const policyState: State = { risk: 0, vars: policyVars, base: total };
  const policyError = execute(policySteps, policyState);
  if (policyError) return fail(policyError);
  total = policyState.base;

  packet.ValidRating = "true";
  packet.RatingError = "";
  packet.TotalPremium = formatNumber(total);
  return { ok: true, error: "", total, rows, flow, packet };
}
