import "dotenv/config";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { loadSigning, sendSigningCode, signDocument, verifySigningCode } from "@/lib/esign";
import { prisma } from "@/lib/prisma";
import { loadView } from "@/lib/ua/load";
import { createQuote, submitPage, type Actor } from "@/lib/ua/pipeline";

const mail: string[] = [];
const originalLog = console.log;
console.log = (...args: unknown[]) => {
  const text = args.map(String).join(" ");
  if (text.includes("[mail]")) mail.push(text);
  else originalLog(...args);
};

async function main() {
  const keep = process.env.KEEP === "1";
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "admin" } });
  const actor: Actor = { userId: admin.id, role: "admin", agentId: null };
  const manual = await prisma.manual.findFirstOrThrow({ where: { name: "Private Car Package Policy" } });
  const created = await createQuote(manual.id, actor);
  assert.ok(created, "quote created");
  const id = created.id;
  const view = await loadView((await prisma.quote.findUniqueOrThrow({ where: { id } })).viewId!);
  const pageId = (name: string) => view!.pages.find((page) => page.name === name)!.id;
  const submit = (pageName: string, navigation: "next" | "stay", values: Record<string, string> = {}, actions: string[] = [], risk?: number) =>
    submitPage({ quoteId: id, pageId: pageId(pageName), navigation, actions, values, risk }, actor);
  const expectOk = async (label: string, promise: ReturnType<typeof submit>) => {
    const result = await promise;
    assert.ok(result.ok, `${label}: ${result.ok ? "" : `${result.message} ${JSON.stringify(result.errors)}`}`);
    originalLog("ok  ", label);
    return result;
  };
  const expectFail = async (label: string, promise: ReturnType<typeof submit>, pattern: RegExp) => {
    const result = await promise;
    assert.ok(!result.ok, `${label} should fail`);
    assert.match(`${result.message} ${Object.values(result.errors).join(" ")}`, pattern, label);
    originalLog("ok  ", label);
  };

  await expectOk(
    "proposer",
    submit("Proposer", "next", { ProposerType: "IND", Title: "MS", FirstName: "Asha", LastName: "Verma", DateOfBirth: "1990-04-02", Mobile: "9876543210", Email: "asha@example.com", Address1: "14 MG Road", Address2: "", City: "Pune", State: "MH", Pincode: "411001" }),
  );
  await expectFail("vehicle is required", submit("Vehicles", "next"), /at least one vehicle/);
  await expectOk(
    "vehicle 1 saved",
    submit("Vehicles", "stay", { RegistrationNumber_1: "mh12ab1234", RTOZone_1: "A", Variant_1: "TM-NEXON-SMART", RegistrationDate_1: "2024-11-13", AntiTheft_1: "N" }, ["SAVERISK"], 1),
  );
  await expectOk("vehicles", submit("Vehicles", "next"));
  await expectOk(
    "policy with previous insurance and finance",
    submit("Policy", "next", { CoverType: "PACKAGE", EffectiveDate: "2026-11-13", Financed: "Y", FinancierName: "HDFC Bank", PreviousInsurance: "Y", PreviousInsurer: "Acme General", PreviousPolicyExpiry: "2026-11-12", ClaimInPreviousYear: "N", NCBPercent: "25" }),
  );
  await expectOk(
    "coverages, which rates on entering the quote page",
    submit("Coverages", "next", { ZeroDep: "Y", EngineProtect: "N", RoadsideAssistance: "N", ReturnToInvoice: "N", VoluntaryDeductible: "0", PAOwnerDriver: "Y", PAPassengers: "0", PaidDriver: "N" }),
  );

  const od = Math.round(640000 * 3.283 * 0.01);
  const ncb = Math.round(od * 25 * -0.01);
  const zeroDep = Math.round(640000 * 0.4 * 0.01);
  const net = od + ncb + zeroDep + 3416 + 375;
  const total = net + Math.round(net * 0.18);
  let quote = await prisma.quote.findUniqueOrThrow({ where: { id } });
  assert.equal(quote.ratingValid, true);
  assert.equal(Number(quote.totalPremium), total, "premium matches the hand calculation");
  originalLog("ok   premium", total);

  await expectOk("quote page to payment", submit("Quote", "next"));
  if (process.env.STOP === "payment") {
    originalLog("stopped before payment; kept quote", id, "payment page", pageId("Payment"));
    return;
  }
  await expectFail("cannot leave payment unpaid", submit("Payment", "next", { PaymentMethod: "UPI" }), /Take the payment/);
  await expectFail("declined payment", submit("Payment", "stay", { PaymentMethod: "UPI", PaymentTestOutcome: "FAIL" }, ["PAY"]), /declined/);
  await expectOk("payment", submit("Payment", "stay", { PaymentMethod: "CARD" }, ["PAY"]));
  const payments = await prisma.payment.findMany({ where: { quoteId: id }, orderBy: { id: "asc" } });
  assert.deepEqual(payments.map((payment) => payment.status), ["FAILED", "SUCCESS"]);
  assert.equal(Number(payments[1].amount), total);
  await expectFail("paid quote cannot be changed", submit("Coverages", "stay", { ZeroDep: "N" }), /has been paid/);
  await expectOk("payment page to e-sign", submit("Payment", "next", { PaymentMethod: "CARD" }));

  await expectOk("start e-sign", submit("E-Sign", "stay", {}, ["ESIGN"]));
  quote = await prisma.quote.findUniqueOrThrow({ where: { id } });
  assert.equal(quote.statusCode, "B");
  const documents = await prisma.esignDocument.findMany({ where: { quoteId: id }, orderBy: { id: "asc" } });
  assert.deepEqual(
    documents.map((document) => document.title),
    ["Proposal Form", "Policy Schedule cum Certificate of Insurance", "Zero Depreciation Add-on Wording", "No Claim Bonus Declaration", "Hypothecation Endorsement"],
    "documents chosen from the answers",
  );
  originalLog("ok   documents", documents.length);
  await expectFail("locked while out for e-sign", submit("Proposer", "stay", { FirstName: "Changed" }), /out for e-sign/);
  await expectOk("resend", submit("E-Sign", "stay", {}, ["RESENDESIGN"]));

  await expectOk("cancel e-sign", submit("E-Sign", "stay", {}, ["RESETESIGN"]));
  assert.equal(await prisma.esignDocument.count({ where: { quoteId: id } }), 0);
  await expectOk("start e-sign again", submit("E-Sign", "stay", {}, ["ESIGN"]));

  const authorization = await prisma.esignAuthorization.findFirstOrThrow({ where: { quoteId: id } });
  const token = authorization.id;
  const firstDocument = (await loadSigning(token))!.signatures[0].document.id;
  assert.equal((await signDocument(token, firstDocument, "203.0.113.9")).ok, false, "cannot sign before the code is confirmed");

  mail.length = 0;
  assert.ok((await sendSigningCode(token, "203.0.113.9")).ok, "code sent");
  assert.equal((await sendSigningCode(token, "203.0.113.9")).ok, false, "second code is throttled");
  const code = /Subject: (\d{6}) is your/.exec(mail.join("\n"))?.[1];
  assert.ok(code, "code found in the email");
  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal((await verifySigningCode({ token, code: wrong, signatureText: "Asha Verma", initialsText: "AV" }, "203.0.113.9")).ok, false, "wrong code rejected");
  assert.ok((await verifySigningCode({ token, code, signatureText: "Asha Verma", initialsText: "AV" }, "203.0.113.9")).ok, "code accepted");
  originalLog("ok   identity confirmed");

  const signing = await loadSigning(token);
  for (const [index, signature] of signing!.signatures.entries()) {
    const result = await signDocument(token, signature.document.id, "203.0.113.9");
    assert.ok(result.ok, `signed ${signature.document.title}`);
    assert.equal(result.ok && result.data.complete, index === signing!.signatures.length - 1);
  }
  originalLog("ok   all documents signed");

  quote = await prisma.quote.findUniqueOrThrow({ where: { id } });
  const policy = await prisma.policy.findUniqueOrThrow({ where: { quoteId: id } });
  assert.equal(quote.statusCode, "A");
  assert.equal(policy.policyNumber, `PD/2026/${String(id).padStart(6, "0")}`);
  assert.equal(Number(policy.totalPremium), total);
  assert.equal(policy.expirationDate.toISOString().slice(0, 10), "2027-11-12");
  const signedDocument = await prisma.esignDocument.findFirstOrThrow({ where: { quoteId: id, title: "Policy Schedule cum Certificate of Insurance" } });
  const unsignedPages = (await PDFDocument.load(signedDocument.unsignedPdf!)).getPageCount();
  const signedPages = (await PDFDocument.load(signedDocument.signedPdf!)).getPageCount();
  assert.equal(signedPages, unsignedPages + 1, "signed PDF has the signature record page");
  assert.ok(mail.some((text) => text.includes("Your policy is issued") && text.includes("Attachments:")), "policy email with attachments");
  await expectFail("issued quote is locked", submit("Proposer", "stay", { FirstName: "Changed" }), /locked/);
  const actions = (await prisma.auditLog.findMany({ where: { entity: "quote", entityId: String(id) }, orderBy: { id: "asc" } })).map((row) => row.action);
  for (const action of ["quote.created", "payment.failed", "payment.success", "esign.started", "esign.cancelled", "esign.authorized", "esign.signed", "policy.issued"]) {
    assert.ok(actions.includes(action), `audit has ${action}`);
  }
  originalLog("ok   policy", policy.policyNumber, "issued; audit rows", actions.length);

  if (keep) {
    originalLog("kept quote", id, "policy id", policy.id, "signing token", token);
  } else {
    await prisma.policy.delete({ where: { id: policy.id } });
    await prisma.quote.delete({ where: { id } });
    await prisma.auditLog.deleteMany({ where: { entity: "quote", entityId: String(id) } });
    originalLog("cleaned up test quote", id);
  }
  originalLog("\nEnd-to-end flow passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
