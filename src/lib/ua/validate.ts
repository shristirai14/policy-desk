import { checkRestrict, evaluateCondition, type ConditionContext } from "@/lib/ua/conditions";
import { fieldKey, isYes } from "@/lib/ua/packet";
import type { UAPage, UAQuestion, UASection } from "@/lib/ua/types";
import { findVariant } from "@/lib/ua/vehicle-catalog";
import { isEntryType, normalizeType, RISK_COUNT_FIELD } from "@/lib/ua/widgets/registry";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const NUMERIC = /^-?\d+(\.\d+)?$/;

export function isSectionVisible(section: UASection, ctx: ConditionContext) {
  if (!checkRestrict(section.restrict, ctx.userType ?? "")) return false;
  if (section.disableCode && evaluateCondition(section.disableCode, ctx)) return false;
  return evaluateCondition(section.props.QuestionConditional, ctx);
}

export function isQuestionVisible(question: UAQuestion, ctx: ConditionContext) {
  if (question.disableCode && evaluateCondition(question.disableCode, ctx)) return false;
  return evaluateCondition(question.props.QuestionConditional, ctx);
}

export function isQuestionReadOnly(question: UAQuestion, ctx: ConditionContext) {
  if (isYes(question.props.ReadOnly)) return true;
  return question.props.ReadOnlyCondition ? evaluateCondition(question.props.ReadOnlyCondition, ctx) : false;
}

export function isQuestionRequired(question: UAQuestion, ctx: ConditionContext) {
  if (question.required) return true;
  return question.props.RequiredCondition ? evaluateCondition(question.props.RequiredCondition, ctx) : false;
}

export function isPageAvailable(page: Pick<UAPage, "disableCode" | "restrict">, ctx: ConditionContext) {
  if (!checkRestrict(page.restrict, ctx.userType ?? "")) return false;
  return !(page.disableCode && evaluateCondition(page.disableCode, ctx));
}

export function questionLabel(question: UAQuestion) {
  const text = question.text.replace(/[:*\s]+$/, "").trim();
  return text || question.fieldName || "This field";
}

export function entryQuestions(page: UAPage, ctx: ConditionContext, risk?: number) {
  const result: UAQuestion[] = [];
  for (const section of page.sections) {
    if (!isSectionVisible(section, ctx)) continue;
    for (const question of section.questions) {
      if (!question.fieldName || !isEntryType(question.type)) continue;
      if (question.riskSpecific !== Boolean(risk)) continue;
      if (!isQuestionVisible(question, ctx) || isQuestionReadOnly(question, ctx)) continue;
      result.push(question);
    }
  }
  return result;
}

function resolveDateBound(raw: string | undefined, ctx: ConditionContext) {
  if (!raw) return "";
  if (raw.toUpperCase() === "TODAY") return ctx.today ?? "";
  if (ISO_DATE.test(raw)) return raw;
  const value = ctx.get(raw);
  return ISO_DATE.test(value) ? value : "";
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function validateQuestion(question: UAQuestion, value: string, ctx: ConditionContext) {
  const label = questionLabel(question);
  const type = normalizeType(question.type);
  const trimmed = value.trim();

  if (type === "checkbox" && isYes(question.props.MustBeChecked) && trimmed === "") {
    return `${label} must be ticked to continue.`;
  }
  if (trimmed === "") return isQuestionRequired(question, ctx) ? `${label} is required.` : "";

  switch (type) {
    case "number": {
      if (!NUMERIC.test(trimmed)) return `${label} must be a number.`;
      const amount = Number(trimmed);
      if (question.min !== null && amount < question.min) return `${label} must be at least ${question.min}.`;
      if (question.max !== null && amount > question.max) return `${label} must be at most ${question.max}.`;
      return "";
    }
    case "date": {
      if (!ISO_DATE.test(trimmed) || Number.isNaN(Date.parse(trimmed))) return `${label} is not a valid date.`;
      const min = resolveDateBound(question.props.MinDate, ctx);
      const max = resolveDateBound(question.props.MaxDate, ctx);
      if (min && trimmed < min) return `${label} cannot be before ${formatDate(min)}.`;
      if (max && trimmed > max) return `${label} cannot be after ${formatDate(max)}.`;
      return "";
    }
    case "vehiclewidget":
      return findVariant(trimmed) ? "" : `Choose the make, model and variant for ${label}.`;
    case "emailwidget":
      return EMAIL.test(trimmed) ? "" : `${label} is not a valid email address.`;
    case "phone":
      return INDIAN_MOBILE.test(trimmed) ? "" : `${label} must be a 10-digit mobile number.`;
    case "select":
      return question.choices.some((choice) => choice.value === trimmed) ? "" : `Choose a value for ${label}.`;
    case "input": {
      const maxLength = Number(question.props.MaxLength);
      if (maxLength > 0 && trimmed.length > maxLength) return `${label} can be at most ${maxLength} characters.`;
      if (question.props.Pattern) {
        try {
          if (!new RegExp(question.props.Pattern).test(trimmed)) {
            return question.props.PatternMessage || `${label} is not in the expected format.`;
          }
        } catch {
          return "";
        }
      }
      return "";
    }
    default:
      return "";
  }
}

export function validatePage(page: UAPage, ctx: ConditionContext, risk?: number) {
  const errors: Record<string, string> = {};
  for (const question of entryQuestions(page, ctx, risk)) {
    const key = fieldKey(question.fieldName, question.riskSpecific, risk);
    const message = validateQuestion(question, ctx.get(key), ctx);
    if (message) errors[key] = message;
  }
  if (!risk) {
    const count = Number(ctx.get(RISK_COUNT_FIELD)) || 0;
    for (const question of detailQuestions(page, ctx)) {
      const min = Number(question.props.MinItems ?? "1") || 0;
      const label = (question.props.ItemLabel || "item").toLowerCase();
      if (count < min) errors[RISK_COUNT_FIELD] = min === 1 ? `Add at least one ${label}.` : `Add at least ${min} ${label}s.`;
    }
  }
  return errors;
}

export function detailQuestions(page: UAPage, ctx: ConditionContext) {
  const result: UAQuestion[] = [];
  for (const section of page.sections) {
    if (!isSectionVisible(section, ctx)) continue;
    for (const question of section.questions) {
      if (normalizeType(question.type) === "detailselection" && isQuestionVisible(question, ctx)) result.push(question);
    }
  }
  return result;
}
