import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkRestrict, evaluateCondition, type ConditionContext } from "@/lib/ua/conditions";
import { initialPacket, runEngine } from "@/lib/ua/engine";
import { interpolate, makeContext } from "@/lib/ua/packet";
import type { Packet, UAPage, UAQuestion, UAView } from "@/lib/ua/types";
import { validatePage } from "@/lib/ua/validate";

function ctxOf(packet: Packet, extra: Partial<ConditionContext> = {}): ConditionContext {
  return { ...makeContext(packet, { userType: "agent" }), today: "2026-11-13", ...extra };
}

function question(partial: Partial<UAQuestion> & { id: number; type: string }): UAQuestion {
  return {
    text: "",
    fieldName: "",
    riskSpecific: false,
    required: false,
    min: null,
    max: null,
    placeholder: "",
    help: "",
    disableCode: null,
    leftCols: 4,
    rightCols: 8,
    props: {},
    choices: [],
    ...partial,
  };
}

function page(id: number, order: number, questions: UAQuestion[], props: Record<string, string> = {}, disableCode: string | null = null): UAPage {
  return {
    id,
    name: `Page ${id}`,
    heading: "",
    subHeading: "",
    props,
    disableCode,
    restrict: null,
    order,
    milestone: true,
    buttonText: `Page ${id}`,
    sections: [{ id: id * 10, name: "S", heading: "", subHeading: "", props: {}, disableCode: null, restrict: null, area: 1, questions }],
  };
}

describe("evaluateCondition", () => {
  const packet = { CoverType: "PACKAGE", NCBPercent: "20", State: "MH", Financed: "N", EffectiveDate: "2026-12-01", Zip_2: "400001" };

  it("treats an empty expression as true", () => {
    assert.equal(evaluateCondition("", ctxOf(packet)), true);
    assert.equal(evaluateCondition(null, ctxOf(packet)), true);
  });

  it("evaluates a single rule, case-insensitively", () => {
    assert.equal(evaluateCondition("CoverType,=,package", ctxOf(packet)), true);
    assert.equal(evaluateCondition("covertype,<>,PACKAGE", ctxOf(packet)), false);
  });

  it("defaults to AND and honours a trailing OR", () => {
    assert.equal(evaluateCondition("CoverType,=,PACKAGE;State,=,GJ", ctxOf(packet)), false);
    assert.equal(evaluateCondition("CoverType,=,PACKAGE;State,=,GJ;OR", ctxOf(packet)), true);
    assert.equal(evaluateCondition("CoverType,=,TP;State,=,MH;AND", ctxOf(packet)), false);
  });

  it("evaluates bracketed groups before the outer joiner", () => {
    assert.equal(evaluateCondition("(State,=,GJ;State,=,MH;OR);CoverType,=,PACKAGE;AND", ctxOf(packet)), true);
    assert.equal(evaluateCondition("(State,=,GJ;State,=,DL;OR);CoverType,=,PACKAGE;AND", ctxOf(packet)), false);
    assert.equal(evaluateCondition("(State,=,GJ;CoverType,=,TP;AND);Financed,=,N;OR", ctxOf(packet)), true);
  });

  it("compares numbers numerically", () => {
    assert.equal(evaluateCondition("NCBPercent,>,5", ctxOf(packet)), true);
    assert.equal(evaluateCondition("NCBPercent,<=,20", ctxOf(packet)), true);
    assert.equal(evaluateCondition("NCBPercent,between,25|50", ctxOf(packet)), false);
    assert.equal(evaluateCondition("NCBPercent,not between,25|50", ctxOf(packet)), true);
  });

  it("handles list membership with either delimiter", () => {
    assert.equal(evaluateCondition("State,in,GJ|MH|DL", ctxOf(packet)), true);
    assert.equal(evaluateCondition("State,in,GJ^DL", ctxOf(packet)), false);
    assert.equal(evaluateCondition("State,not in,GJ|DL", ctxOf(packet)), true);
  });

  it("handles blanks", () => {
    assert.equal(evaluateCondition("Missing,=,BLANK", ctxOf(packet)), true);
    assert.equal(evaluateCondition("State,<>,BLANK", ctxOf(packet)), true);
    assert.equal(evaluateCondition("Missing,>,0", ctxOf(packet)), false);
    assert.equal(evaluateCondition("Missing,in,A|B", ctxOf(packet)), false);
    assert.equal(evaluateCondition("Missing,not in,A|B", ctxOf(packet)), true);
  });

  it("resolves TODAY, quoted literals and field references on the right", () => {
    assert.equal(evaluateCondition("EffectiveDate,>=,TODAY", ctxOf(packet)), true);
    assert.equal(evaluateCondition("EffectiveDate,<,TODAY", ctxOf(packet)), false);
    assert.equal(evaluateCondition("State,=,'MH'", ctxOf(packet)), true);
    assert.equal(evaluateCondition("State,=,OtherState", ctxOf({ ...packet, OtherState: "MH" })), true);
  });

  it("resolves usertype and the risk suffix", () => {
    assert.equal(evaluateCondition("usertype,=,Agent", ctxOf(packet)), true);
    assert.equal(evaluateCondition("usertype,=,internal", ctxOf(packet)), false);
    assert.equal(evaluateCondition("Zip,=,400001", ctxOf(packet, { suffix: "2" })), true);
    assert.equal(evaluateCondition("Zip,=,400001", ctxOf(packet)), false);
    assert.equal(evaluateCondition("suffix,=,2", ctxOf(packet, { suffix: "2" })), true);
  });

  it("supports text operators and rejects malformed rules", () => {
    assert.equal(evaluateCondition("CoverType,starts with,PACK", ctxOf(packet)), true);
    assert.equal(evaluateCondition("CoverType,ends with,AGE", ctxOf(packet)), true);
    assert.equal(evaluateCondition("CoverType,contains,cka", ctxOf(packet)), true);
    assert.equal(evaluateCondition("CoverType,not contains,TP", ctxOf(packet)), true);
    assert.equal(evaluateCondition("CoverType,=", ctxOf(packet)), false);
  });
});

describe("checkRestrict", () => {
  it("allows everyone when empty and applies allow and deny tokens", () => {
    assert.equal(checkRestrict("", "agent"), true);
    assert.equal(checkRestrict("ALL", "agent"), true);
    assert.equal(checkRestrict("internal", "agent"), false);
    assert.equal(checkRestrict("-agent", "agent"), false);
    assert.equal(checkRestrict("-agent", "internal"), true);
  });
});

describe("interpolate", () => {
  it("replaces field placeholders", () => {
    assert.equal(interpolate("Hello {{FirstName}} {{ Missing }}!", ctxOf({ FirstName: "Asha" })), "Hello Asha !");
  });
});

describe("validatePage", () => {
  const select = question({
    id: 1,
    type: "Select",
    fieldName: "CoverType",
    text: "Policy type",
    required: true,
    choices: [
      { value: "PACKAGE", text: "Package", isDefault: true, disableCode: null },
      { value: "TP", text: "Third party", isDefault: false, disableCode: null },
    ],
  });
  const conditional = question({
    id: 2,
    type: "Input",
    fieldName: "FinancierName",
    text: "Financier name:",
    props: { QuestionConditional: "Financed,=,Y", RequiredCondition: "Financed,=,Y" },
  });
  const mobile = question({ id: 3, type: "Phone", fieldName: "Mobile", text: "Mobile" });
  const amount = question({ id: 4, type: "Number", fieldName: "Price", text: "Price", min: 100, max: 500 });
  const start = question({ id: 5, type: "Date", fieldName: "EffectiveDate", text: "Start date", props: { MinDate: "TODAY" } });
  const pin = question({
    id: 6,
    type: "Input",
    fieldName: "Pincode",
    text: "PIN code",
    props: { Pattern: "^[1-9][0-9]{5}$", PatternMessage: "PIN code must be 6 digits." },
  });
  const formPage = page(1, 10, [select, conditional, mobile, amount, start, pin]);

  it("reports required, format and range errors", () => {
    const errors = validatePage(
      formPage,
      ctxOf({ Financed: "Y", Mobile: "12345", Price: "50", EffectiveDate: "2026-01-01", Pincode: "012345" }),
    );
    assert.equal(errors.CoverType, "Policy type is required.");
    assert.equal(errors.FinancierName, "Financier name is required.");
    assert.equal(errors.Mobile, "Mobile must be a 10-digit mobile number.");
    assert.equal(errors.Price, "Price must be at least 100.");
    assert.equal(errors.EffectiveDate, "Start date cannot be before 13/11/2026.");
    assert.equal(errors.Pincode, "PIN code must be 6 digits.");
  });

  it("skips hidden questions and accepts valid answers", () => {
    const errors = validatePage(
      formPage,
      ctxOf({ CoverType: "TP", Financed: "N", Mobile: "9876543210", Price: "250", EffectiveDate: "2026-11-13", Pincode: "400001" }),
    );
    assert.deepEqual(errors, {});
  });

  it("rejects a select value that is not a choice", () => {
    assert.equal(validatePage(formPage, ctxOf({ CoverType: "BOGUS" })).CoverType, "Choose a value for Policy type.");
  });
});

describe("runEngine", () => {
  const first = page(1, 10, [
    question({ id: 1, type: "YesNo", fieldName: "Financed", text: "Financed", required: true, props: { DefaultValue: "N" } }),
    question({ id: 2, type: "Input", fieldName: "FinancierName", text: "Financier", props: { QuestionConditional: "Financed,=,Y", RequiredCondition: "Financed,=,Y" } }),
    question({ id: 3, type: "Input", fieldName: "Locked", text: "Locked", props: { ReadOnly: "Y" } }),
    question({ id: 4, type: "SetValue", fieldName: "HasFinance", props: { Value: "YES", QuestionConditional: "Financed,=,Y" } }),
  ]);
  const skipped = page(2, 20, [question({ id: 5, type: "Input", fieldName: "Extra" })], {}, "Financed,=,N");
  const last = page(3, 30, [question({ id: 6, type: "Input", fieldName: "Note" })], { SetValue: "Visited|Y", AdditionalAction: "RATE" });
  const view: UAView = { id: 1, manualId: 1, name: "V", props: {}, pages: [first, skipped, last] };
  const base = { view, userType: "agent", actions: [] as string[] };

  it("fills defaults into a new packet", () => {
    assert.deepEqual(initialPacket(view, { QuoteNumber: "Q1" }), { QuoteNumber: "Q1", Financed: "N" });
  });

  it("stays on the page and returns errors when validation fails", () => {
    const result = runEngine({ ...base, packet: {}, pageId: 1, values: { Financed: "Y", FinancierName: "" }, navigation: "next" });
    assert.equal(result.targetPageId, 1);
    assert.equal(result.errors.FinancierName, "Financier is required.");
    assert.equal(result.packet.Financed, "Y");
  });

  it("skips disabled pages, runs SetValue and queues the target page's actions", () => {
    const result = runEngine({ ...base, packet: {}, pageId: 1, values: { Financed: "N" }, navigation: "next" });
    assert.deepEqual(result.errors, {});
    assert.equal(result.targetPageId, 3);
    assert.equal(result.packet.Visited, "Y");
    assert.equal(result.packet.HasFinance, undefined);
    assert.deepEqual(result.actions, ["RATE"]);
    assert.equal(result.changed, true);
  });

  it("includes the conditional page when its condition allows it", () => {
    const result = runEngine({ ...base, packet: {}, pageId: 1, values: { Financed: "Y", FinancierName: "HDFC Bank" }, navigation: "next" });
    assert.equal(result.targetPageId, 2);
    assert.equal(result.packet.HasFinance, "YES");
  });

  it("ignores posted values for read-only, hidden and unknown fields", () => {
    const result = runEngine({
      ...base,
      packet: { Locked: "original" },
      pageId: 1,
      values: { Financed: "N", Locked: "tampered", FinancierName: "hidden", Note: "other page", Evil: "x" },
      navigation: "stay",
    });
    assert.equal(result.packet.Locked, "original");
    assert.equal(result.packet.FinancierName, undefined);
    assert.equal(result.packet.Note, undefined);
    assert.equal(result.packet.Evil, undefined);
  });

  it("goes back without validating", () => {
    const result = runEngine({ ...base, packet: { Financed: "N" }, pageId: 3, values: { Note: "" }, navigation: "prev" });
    assert.deepEqual(result.errors, {});
    assert.equal(result.targetPageId, 1);
  });

  it("reports no change when the answers are the same", () => {
    const result = runEngine({ ...base, packet: { Financed: "N" }, pageId: 1, values: { Financed: "N" }, navigation: "stay" });
    assert.equal(result.changed, false);
  });
});

describe("condition text", () => {
  it("round-trips simple expressions through the rule editor format", async () => {
    const { buildSimple, parseSimple, fieldsInCondition } = await import("@/lib/ua/condition-text");
    assert.deepEqual(parseSimple(""), { rules: [], joiner: "AND" });
    assert.deepEqual(parseSimple("Financed,=,Y"), { rules: [{ field: "Financed", operator: "=", value: "Y" }], joiner: "AND" });
    const parsed = parseSimple("(A,=,1;B,in,X|Y;OR)");
    assert.equal(parsed?.joiner, "OR");
    assert.equal(buildSimple(parsed?.rules ?? [], "OR"), "A,=,1;B,in,X|Y;OR");
    assert.equal(parseSimple("(A,=,1;B,=,2;OR);C,=,3;AND"), null);
    assert.equal(buildSimple([{ field: "", operator: "=", value: "x" }], "AND"), "");
    assert.equal(buildSimple([{ field: "A", operator: "=", value: "" }], "AND"), "A,=,BLANK");
    assert.deepEqual(fieldsInCondition("(A,=,1;B,=,2;OR);usertype,=,agent;AND"), ["A", "B", "usertype"]);
  });
});


describe("vehicles on a page", () => {
  const list = question({ id: 20, type: "DetailSelection", props: { ItemLabel: "Vehicle", MinItems: "1" } });
  const reg = question({ id: 21, type: "Input", fieldName: "RegistrationNumber", text: "Registration number", riskSpecific: true, required: true, props: { Uppercase: "Y" } });
  const variant = question({ id: 22, type: "VehicleWidget", fieldName: "Variant", text: "Vehicle", riskSpecific: true, required: true });
  const owner = question({ id: 23, type: "Input", fieldName: "OwnerNote", text: "Note" });
  const vehicles = page(1, 10, [list, reg, variant, owner]);
  const after = page(2, 20, [question({ id: 24, type: "Input", fieldName: "Later" })]);
  const view: UAView = { id: 1, manualId: 1, name: "V", props: {}, pages: [vehicles, after] };
  const base = { view, userType: "agent", pageId: 1, maxRisks: 2 };

  it("requires a vehicle before leaving the page", () => {
    const result = runEngine({ ...base, packet: { NumberOfRisks: "0" }, values: {}, navigation: "next", actions: [] });
    assert.equal(result.errors.NumberOfRisks, "Add at least one vehicle.");
    assert.equal(result.targetPageId, 1);
  });

  it("validates and saves a new vehicle, deriving its catalog details", () => {
    const bad = runEngine({ ...base, packet: { NumberOfRisks: "0" }, values: { RegistrationNumber_1: "", Variant_1: "nope" }, navigation: "stay", actions: ["SAVERISK"], risk: 1 });
    assert.equal(bad.errors.RegistrationNumber_1, "Registration number is required.");
    assert.equal(bad.errors.Variant_1, "Choose the make, model and variant for Vehicle.");
    assert.equal(bad.packet.NumberOfRisks, "0");

    const good = runEngine({ ...base, packet: { NumberOfRisks: "0" }, values: { RegistrationNumber_1: "mh12ab1234", Variant_1: "TM-NEXON-SMART", OwnerNote: "ignored" }, navigation: "stay", actions: ["SAVERISK"], risk: 1 });
    assert.deepEqual(good.errors, {});
    assert.equal(good.packet.NumberOfRisks, "1");
    assert.equal(good.packet.RegistrationNumber_1, "MH12AB1234");
    assert.equal(good.packet.Make_1, "Tata");
    assert.equal(good.packet.CubicCapacity_1, "1199");
    assert.equal(good.packet.ExShowroomPrice_1, "800000");
    assert.equal(good.packet.OwnerNote, undefined);
  });

  it("refuses a vehicle beyond the limit or out of sequence", () => {
    const packet = { NumberOfRisks: "2" };
    const values = { RegistrationNumber_3: "MH12AB1234", Variant_3: "TM-NEXON-SMART" };
    assert.match(runEngine({ ...base, packet, values, navigation: "stay", actions: ["SAVERISK"], risk: 3 }).errors.NumberOfRisks, /at most 2/);
    assert.match(runEngine({ ...base, packet, values, navigation: "stay", actions: ["SAVERISK"], risk: 5 }).errors.NumberOfRisks, /no longer exists/);
  });

  it("deletes a vehicle and renumbers the ones after it", () => {
    const packet = { NumberOfRisks: "3", RegistrationNumber_1: "A", RegistrationNumber_2: "B", RegistrationNumber_3: "C", Make_2: "Tata", Make_3: "Honda", Keep_Me: "x" };
    const result = runEngine({ ...base, packet, values: {}, navigation: "stay", actions: ["DELETERISK"], risk: 2 });
    assert.equal(result.packet.NumberOfRisks, "2");
    assert.equal(result.packet.RegistrationNumber_1, "A");
    assert.equal(result.packet.RegistrationNumber_2, "C");
    assert.equal(result.packet.Make_2, "Honda");
    assert.equal(result.packet.RegistrationNumber_3, undefined);
    assert.equal(result.packet.Keep_Me, "x");
    assert.equal(result.changed, true);
  });

  it("blocks leaving when a saved vehicle is incomplete and allows it when complete", () => {
    const incomplete = runEngine({ ...base, packet: { NumberOfRisks: "1", RegistrationNumber_1: "MH12AB1234" }, values: {}, navigation: "next", actions: [] });
    assert.equal(incomplete.errors.NumberOfRisks, "Vehicle 1 has missing or invalid details. Edit it to fix them.");
    const complete = runEngine({ ...base, packet: { NumberOfRisks: "1", RegistrationNumber_1: "MH12AB1234", Variant_1: "TM-NEXON-SMART" }, values: {}, navigation: "next", actions: [] });
    assert.deepEqual(complete.errors, {});
    assert.equal(complete.targetPageId, 2);
  });
});
