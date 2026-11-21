import { evaluateCondition, todayIso } from "@/lib/ua/conditions";
import { fieldKey, interpolate, isYes, makeContext, parseList, parsePairs } from "@/lib/ua/packet";
import type { Navigation, Packet, UAPage, UAView } from "@/lib/ua/types";
import { detailQuestions, entryQuestions, isPageAvailable, isQuestionVisible, isSectionVisible, validatePage } from "@/lib/ua/validate";
import { vehicleFields } from "@/lib/ua/vehicle-catalog";
import { normalizeType, RISK_COUNT_FIELD } from "@/lib/ua/widgets/registry";

export type EngineInput = {
  view: UAView;
  packet: Packet;
  pageId: number;
  values: Record<string, string>;
  navigation: Navigation;
  actions: string[];
  userType: string;
  risk?: number;
  maxRisks?: number;
};

export type EngineOutput = {
  packet: Packet;
  errors: Record<string, string>;
  targetPageId: number;
  targetViewId: number | null;
  actions: string[];
  changed: boolean;
};

const RISK_ACTIONS = ["saverisk", "deleterisk"];

export function availablePages(view: UAView, packet: Packet, userType: string) {
  const ctx = makeContext(packet, { userType });
  return view.pages.filter((page) => isPageAvailable(page, ctx));
}

export function resolveDefault(raw: string) {
  return raw.toUpperCase() === "TODAY" ? todayIso() : raw;
}

export function riskCount(packet: Packet) {
  return Math.max(0, Math.floor(Number(packet[RISK_COUNT_FIELD]) || 0));
}

export function initialPacket(view: UAView, seed: Packet) {
  const packet: Packet = { ...seed };
  for (const page of view.pages) {
    for (const section of page.sections) {
      for (const question of section.questions) {
        if (!question.fieldName || question.riskSpecific || packet[question.fieldName] !== undefined) continue;
        const fromChoice = question.choices.find((choice) => choice.isDefault)?.value;
        const value = question.props.DefaultValue ?? fromChoice;
        if (value !== undefined && value !== "") packet[question.fieldName] = resolveDefault(value);
      }
    }
  }
  return packet;
}

export function riskDefaults(page: UAPage, risk: number) {
  const defaults: Packet = {};
  for (const section of page.sections) {
    for (const question of section.questions) {
      if (!question.fieldName || !question.riskSpecific) continue;
      const fromChoice = question.choices.find((choice) => choice.isDefault)?.value;
      const value = question.props.DefaultValue ?? fromChoice;
      if (value !== undefined && value !== "") defaults[fieldKey(question.fieldName, true, risk)] = resolveDefault(value);
    }
  }
  return defaults;
}

function applySetValues(page: UAPage, packet: Packet, userType: string) {
  for (const section of page.sections) {
    if (!isSectionVisible(section, makeContext(packet, { userType }))) continue;
    for (const question of section.questions) {
      if (normalizeType(question.type) !== "setvalue" || !question.fieldName || question.riskSpecific) continue;
      const current = makeContext(packet, { userType });
      if (!isQuestionVisible(question, current)) continue;
      packet[question.fieldName] = interpolate(resolveDefault(question.props.Value ?? ""), current);
    }
  }
}

function mergeValues(page: UAPage, packet: Packet, values: Record<string, string>, userType: string, risk?: number) {
  const overlay: Packet = { ...packet };
  for (const [key, value] of Object.entries(values)) overlay[key] = value;
  const ctx = makeContext(overlay, { userType, risk });
  let changed = false;
  const write = (key: string, value: string) => {
    if ((packet[key] ?? "") !== value) changed = true;
    packet[key] = value;
  };
  for (const question of entryQuestions(page, ctx, risk)) {
    const key = fieldKey(question.fieldName, question.riskSpecific, risk);
    if (!(key in values)) continue;
    let value = String(values[key] ?? "").trim();
    if (isYes(question.props.Uppercase)) value = value.toUpperCase();
    write(key, value);
    if (normalizeType(question.type) === "vehiclewidget") {
      for (const [field, derived] of Object.entries(vehicleFields(value))) write(fieldKey(field, question.riskSpecific, risk), derived);
    }
  }
  return changed;
}

function deleteRisk(packet: Packet, risk: number) {
  const count = riskCount(packet);
  if (risk < 1 || risk > count) return false;
  for (const key of Object.keys(packet)) {
    const match = /^(.*)_(\d+)$/.exec(key);
    if (!match) continue;
    const index = Number(match[2]);
    if (index === risk) delete packet[key];
  }
  for (let index = risk + 1; index <= count; index += 1) {
    for (const key of Object.keys(packet)) {
      const match = /^(.*)_(\d+)$/.exec(key);
      if (!match || Number(match[2]) !== index) continue;
      packet[`${match[1]}_${index - 1}`] = packet[key];
      delete packet[key];
    }
  }
  packet[RISK_COUNT_FIELD] = String(count - 1);
  return true;
}

function validateRisks(page: UAPage, packet: Packet, userType: string) {
  const errors: Record<string, string> = {};
  const details = detailQuestions(page, makeContext(packet, { userType }));
  if (details.length === 0) return errors;
  const label = details[0].props.ItemLabel || "Item";
  for (let risk = 1; risk <= riskCount(packet); risk += 1) {
    const found = validatePage(page, makeContext(packet, { userType, risk }), risk);
    if (Object.keys(found).length > 0) {
      errors[RISK_COUNT_FIELD] = `${label} ${risk} has missing or invalid details. Edit it to fix them.`;
      break;
    }
  }
  return errors;
}

function resolveByNavigation(pages: UAPage[], currentId: number, navigation: Navigation) {
  const index = pages.findIndex((page) => page.id === currentId);
  if (index === -1) return pages[0]?.id ?? currentId;
  if (navigation === "next") return pages[Math.min(index + 1, pages.length - 1)].id;
  if (navigation === "prev") return pages[Math.max(index - 1, 0)].id;
  return currentId;
}

export function runEngine(input: EngineInput): EngineOutput {
  const { view, userType, navigation } = input;
  const packet: Packet = { ...input.packet };
  const page = view.pages.find((candidate) => candidate.id === input.pageId);
  const stay = (errors: Record<string, string>, changed: boolean): EngineOutput => ({
    packet,
    errors,
    targetPageId: input.pageId,
    targetViewId: null,
    actions: [],
    changed,
  });
  if (!page) return stay({}, false);

  const has = (list: string[], name: string) => list.some((action) => action.toLowerCase() === name.toLowerCase());

  if (has(input.actions, "DELETERISK")) {
    return stay({}, deleteRisk(packet, input.risk ?? 0));
  }

  if (has(input.actions, "SAVERISK")) {
    const count = riskCount(packet);
    const risk = input.risk ?? 0;
    const limit = input.maxRisks ?? 5;
    if (risk < 1 || risk > count + 1) return stay({ [RISK_COUNT_FIELD]: "That item no longer exists. Reload the page." }, false);
    if (risk > limit) return stay({ [RISK_COUNT_FIELD]: `A quote can have at most ${limit} of these.` }, false);
    mergeValues(page, packet, input.values, userType, risk);
    const errors = validatePage(page, makeContext(packet, { userType, risk }), risk);
    if (Object.keys(errors).length > 0) return stay(errors, true);
    if (risk === count + 1) packet[RISK_COUNT_FIELD] = String(risk);
    return stay({}, true);
  }

  const changed = mergeValues(page, packet, input.values, userType);
  applySetValues(page, packet, userType);

  const actions = [...parseList(page.props.PostAdditionalAction), ...input.actions.filter((action) => !RISK_ACTIONS.includes(action.toLowerCase()))];
  const leaving = navigation === "next" || actions.length > 0;
  const errors: Record<string, string> =
    leaving && navigation !== "prev"
      ? { ...validateRisks(page, packet, userType), ...validatePage(page, makeContext(packet, { userType })) }
      : {};
  if (navigation === "next" && packet.PaymentStatus !== "PAID") {
    const paymentQuestion = entryQuestions(page, makeContext(packet, { userType })).find((question) => normalizeType(question.type) === "paymentwidget");
    if (paymentQuestion) errors[paymentQuestion.fieldName] = "Take the payment before continuing.";
  }
  if (Object.keys(errors).length > 0) return stay(errors, changed);

  const pages = availablePages(view, packet, userType);
  let targetPageId = resolveByNavigation(pages, page.id, navigation);
  let targetViewId: number | null = null;
  const ctx = makeContext(packet, { userType });

  if (has(actions, "ChangePage")) {
    for (const suffix of ["", "1", "2", "3", "4", "5"]) {
      const target = Number(page.props[`TargetPageID${suffix}`]);
      if (!target) continue;
      if (evaluateCondition(page.props[`ChangePageConditionals${suffix}`], ctx)) {
        targetPageId = target;
        break;
      }
    }
  }
  if (has(actions, "ChangeView") && evaluateCondition(page.props.ChangeViewConditionals, ctx)) {
    const viewTarget = Number(page.props.TargetViewID);
    if (viewTarget) {
      targetViewId = viewTarget;
      targetPageId = Number(page.props.TargetPageID) || 0;
    }
  }

  const target = view.pages.find((candidate) => candidate.id === targetPageId);
  if (target && targetViewId === null && target.id !== page.id) {
    for (const [key, value] of parsePairs(target.props.SetValue)) packet[key] = resolveDefault(value);
    applySetValues(target, packet, userType);
    actions.push(...parseList(target.props.AdditionalAction));
  }

  const remaining = actions.filter((action) => !["changepage", "changeview"].includes(action.toLowerCase()));
  return { packet, errors: {}, targetPageId, targetViewId, actions: remaining, changed };
}
