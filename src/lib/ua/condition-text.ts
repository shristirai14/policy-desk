export type Rule = { field: string; operator: string; value: string };

export type Joiner = "AND" | "OR";

export const OPERATORS: Array<{ value: string; label: string }> = [
  { value: "=", label: "is" },
  { value: "<>", label: "is not" },
  { value: ">", label: "is greater than" },
  { value: ">=", label: "is at least" },
  { value: "<", label: "is less than" },
  { value: "<=", label: "is at most" },
  { value: "in", label: "is one of" },
  { value: "not in", label: "is not one of" },
  { value: "contains", label: "contains" },
  { value: "starts with", label: "starts with" },
  { value: "between", label: "is between" },
];

export function parseSimple(expression: string | null | undefined): { rules: Rule[]; joiner: Joiner } | null {
  let text = (expression ?? "").trim();
  if (!text) return { rules: [], joiner: "AND" };
  if (text.startsWith("(") && text.endsWith(")") && !text.slice(1, -1).includes("(")) text = text.slice(1, -1);
  if (text.includes("(") || text.includes(")")) return null;

  let joiner: Joiner = "AND";
  const rules: Rule[] = [];
  for (const item of text.split(";").map((part) => part.trim()).filter(Boolean)) {
    const upper = item.toUpperCase();
    if (upper === "AND" || upper === "OR") {
      joiner = upper;
      continue;
    }
    const parts = item.split(",");
    if (parts.length < 3) return null;
    rules.push({ field: parts[0].trim(), operator: parts[1].trim().toLowerCase(), value: parts.slice(2).join(",").trim() });
  }
  return { rules, joiner };
}

export function buildSimple(rules: Rule[], joiner: Joiner) {
  const complete = rules.filter((rule) => rule.field.trim() && rule.operator);
  const parts = complete.map((rule) => `${rule.field.trim()},${rule.operator},${rule.value.trim() || "BLANK"}`);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.join(";")};${joiner}`;
}

export function fieldsInCondition(expression: string | null | undefined) {
  const names: string[] = [];
  for (const item of (expression ?? "").replace(/[()]/g, "").split(";")) {
    const parts = item.split(",");
    if (parts.length < 3) continue;
    const name = parts[0].trim();
    if (name && !name.startsWith("^")) names.push(name);
  }
  return names;
}
