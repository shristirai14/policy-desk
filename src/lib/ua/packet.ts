import { todayIso, type ConditionContext } from "@/lib/ua/conditions";
import type { Packet } from "@/lib/ua/types";

export function fieldKey(fieldName: string, riskSpecific: boolean, risk?: number) {
  return riskSpecific && risk ? `${fieldName}_${risk}` : fieldName;
}

export function getValue(packet: Packet, name: string) {
  const direct = packet[name];
  if (direct !== undefined) return direct;
  const lower = name.toLowerCase();
  for (const key in packet) {
    if (key.toLowerCase() === lower) return packet[key];
  }
  return "";
}

export function makeContext(packet: Packet, options: { userType: string; risk?: number }): ConditionContext {
  return {
    get: (name) => getValue(packet, name),
    userType: options.userType,
    suffix: options.risk ? String(options.risk) : undefined,
    today: todayIso(),
  };
}

export function interpolate(text: string, ctx: ConditionContext) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name: string) => {
    if (name.toLowerCase() === "suffix") return ctx.suffix ?? "";
    const direct = ctx.get(name);
    return direct !== "" || !ctx.suffix ? direct : ctx.get(`${name}_${ctx.suffix}`);
  });
}

export function parsePairs(value: string | undefined) {
  const pairs: Array<[string, string]> = [];
  for (const item of (value ?? "").split(",")) {
    const [key, ...rest] = item.split("|");
    if (key.trim()) pairs.push([key.trim(), rest.join("|").trim()]);
  }
  return pairs;
}

export function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isYes(value: string | undefined) {
  return ["y", "yes", "true", "t", "1"].includes((value ?? "").trim().toLowerCase());
}
