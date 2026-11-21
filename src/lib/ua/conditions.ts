export type ConditionContext = {
  get: (name: string) => string;
  userType?: string;
  suffix?: string;
  today?: string;
};

const NUMERIC = /^-?\d+(\.\d+)?$/;

export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function splitTopLevel(input: string, separator: string) {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function lookup(name: string, ctx: ConditionContext) {
  const direct = ctx.get(name);
  if (direct !== "" || !ctx.suffix) return direct;
  return ctx.get(`${name}_${ctx.suffix}`);
}

function resolveLeft(raw: string, ctx: ConditionContext) {
  const lower = raw.toLowerCase();
  if (lower === "usertype") return ctx.userType ?? "";
  if (lower === "suffix") return ctx.suffix ?? "";
  if (raw.startsWith("^")) return raw.slice(1);
  return lookup(raw, ctx);
}

function resolveRight(raw: string, ctx: ConditionContext) {
  const upper = raw.toUpperCase();
  if (upper === "BLANK" || raw === "''") return "";
  if (upper === "TODAY") return ctx.today ?? todayIso();
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
  if (raw.startsWith("^")) return raw.slice(1);
  if (NUMERIC.test(raw)) return raw;
  const fieldValue = lookup(raw, ctx);
  return fieldValue !== "" ? fieldValue : raw;
}

function compare(a: string, b: string) {
  if (NUMERIC.test(a) && NUMERIC.test(b)) return Number(a) - Number(b);
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function splitList(raw: string) {
  const delimiter = raw.includes("|") ? "|" : "^";
  return raw.split(delimiter).map((item) => item.trim());
}

function evaluateRule(rule: string, ctx: ConditionContext) {
  const parts = rule.split(",");
  if (parts.length < 3) return false;
  const left = resolveLeft(parts[0].trim(), ctx);
  const operator = parts[1].trim().toLowerCase();
  const rawRight = parts.slice(2).join(",").trim();

  switch (operator) {
    case "=":
    case "eq":
      return compare(left, resolveRight(rawRight, ctx)) === 0;
    case "<>":
    case "neq":
      return compare(left, resolveRight(rawRight, ctx)) !== 0;
    case "in":
    case "in list":
      return left !== "" && splitList(rawRight).some((item) => compare(left, item) === 0);
    case "not in":
    case "not in list":
      return left === "" || !splitList(rawRight).some((item) => compare(left, item) === 0);
    case "not contains":
      return !left.toLowerCase().includes(resolveRight(rawRight, ctx).toLowerCase());
  }

  if (left === "") return false;
  const right = resolveRight(rawRight, ctx);

  switch (operator) {
    case ">":
    case "gt":
      return compare(left, right) > 0;
    case ">=":
    case "gte":
      return compare(left, right) >= 0;
    case "<":
    case "lt":
      return compare(left, right) < 0;
    case "<=":
    case "lte":
      return compare(left, right) <= 0;
    case "contains":
      return left.toLowerCase().includes(right.toLowerCase());
    case "starts with":
      return left.toLowerCase().startsWith(right.toLowerCase());
    case "ends with":
      return left.toLowerCase().endsWith(right.toLowerCase());
    case "between":
    case "not between": {
      const [min = "", max = ""] = splitList(rawRight).map((bound) => resolveRight(bound, ctx));
      const inside = compare(left, min) >= 0 && compare(left, max) <= 0;
      return operator === "between" ? inside : !inside;
    }
    default:
      return false;
  }
}

function evaluateLevel(text: string, ctx: ConditionContext): boolean {
  let joiner = "AND";
  const checks: Array<() => boolean> = [];
  for (const item of splitTopLevel(text, ";")) {
    const upper = item.toUpperCase();
    if (upper === "AND" || upper === "OR") {
      joiner = upper;
    } else if (item.startsWith("(") && item.endsWith(")")) {
      checks.push(() => evaluateLevel(item.slice(1, -1), ctx));
    } else {
      checks.push(() => evaluateRule(item, ctx));
    }
  }
  if (checks.length === 0) return true;
  return joiner === "OR" ? checks.some((check) => check()) : checks.every((check) => check());
}

export function evaluateCondition(expression: string | null | undefined, ctx: ConditionContext) {
  const text = (expression ?? "").trim();
  if (!text) return true;
  return evaluateLevel(text, ctx);
}

export function checkRestrict(restrict: string | null | undefined, userType: string) {
  const tokens = (restrict ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const user = userType.toLowerCase();
  if (tokens.includes(`-${user}`) || tokens.includes("-all")) return false;
  const allowList = tokens.filter((token) => !token.startsWith("-"));
  return allowList.length === 0 || allowList.includes("all") || allowList.includes(user);
}
