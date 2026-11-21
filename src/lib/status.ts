export const QUOTE_STATUS: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  P: { label: "In progress", tone: "secondary" },
  S: { label: "Submitted", tone: "outline" },
  B: { label: "Out for e-sign", tone: "warning" },
  A: { label: "Approved", tone: "success" },
  D: { label: "Denied", tone: "destructive" },
  X: { label: "Deleted", tone: "destructive" },
};

export function statusOf(code: string) {
  return QUOTE_STATUS[code] ?? { label: code, tone: "outline" as const };
}

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const DATE = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const DATE_UTC = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatMoney(value: number | string | { toString(): string } | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value.toString());
  return Number.isNaN(amount) ? "" : INR.format(amount);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return typeof value === "string" && ISO_DATE_ONLY.test(value) ? DATE_UTC.format(date) : DATE.format(date);
}

export function formatCalendarDate(value: Date | null | undefined) {
  return value && !Number.isNaN(value.getTime()) ? DATE_UTC.format(value) : "";
}
