import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { cancelEsign, issuePolicy, resendEsign, startEsign } from "@/lib/esign";
import { takePayment } from "@/lib/payment";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/permissions";
import { rateAndStore } from "@/lib/rating/rate-quote";
import { availablePages, initialPacket, runEngine } from "@/lib/ua/engine";
import { loadView } from "@/lib/ua/load";
import { getValue } from "@/lib/ua/packet";
import type { Navigation, Packet, SubmitResult, UAPage, UAView } from "@/lib/ua/types";
import { normalizeType } from "@/lib/ua/widgets/registry";

export type Actor = { userId: string; role: Role; agentId: string | null };

export function userTypeOf(role: Role) {
  return role === "agent" ? "agent" : "internal";
}

export function quoteScope(actor: Actor): Prisma.QuoteWhereInput {
  return actor.role === "agent" ? { userId: actor.userId } : {};
}

export function asPacket(value: unknown): Packet {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const packet: Packet = {};
  for (const [key, item] of Object.entries(value)) packet[key] = item === null ? "" : String(item);
  return packet;
}

function summaryColumns(packet: Packet) {
  const name = [getValue(packet, "FirstName"), getValue(packet, "LastName")].filter(Boolean).join(" ");
  const effective = getValue(packet, "EffectiveDate");
  const parsed = effective ? new Date(effective) : null;
  return {
    applicantName: name || getValue(packet, "ApplicantName") || null,
    applicantMobile: getValue(packet, "Mobile") || null,
    applicantEmail: getValue(packet, "Email") || null,
    registrationNumber: getValue(packet, "RegistrationNumber_1") || getValue(packet, "RegistrationNumber") || null,
    effectiveDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
  };
}

function pageHasWidget(page: UAPage | undefined, types: string[]) {
  return Boolean(page?.sections.some((section) => section.questions.some((question) => types.includes(normalizeType(question.type)))));
}

function paymentComesFirst(view: UAView, pageId: number) {
  const index = view.pages.findIndex((page) => page.id === pageId);
  return view.pages.some((page, position) => position <= index && pageHasWidget(page, ["paymentwidget"]));
}

export async function createQuote(manualId: number, actor: Actor) {
  const userType = userTypeOf(actor.role);
  const views = await prisma.manualView.findMany({ where: { manualId }, orderBy: { id: "asc" } });
  const viewRow = views.find((candidate) => {
    const classes = candidate.userClassList.toLowerCase().split(",").map((item) => item.trim());
    const codes = candidate.quoteCodeList.toUpperCase().split(",").map((item) => item.trim());
    return (classes.includes("all") || classes.includes(userType)) && codes.includes("A");
  });
  if (!viewRow) return null;
  const view = await loadView(viewRow.id);
  if (!view) return null;

  const agent = actor.agentId ? await prisma.agent.findUnique({ where: { id: actor.agentId } }) : null;
  const draft = await prisma.quote.create({
    data: {
      quoteNumber: `TMP-${crypto.randomUUID()}`,
      manualId,
      viewId: view.id,
      userId: actor.userId,
      agentId: actor.agentId,
    },
  });
  const quoteNumber = `Q${String(draft.id).padStart(6, "0")}`;
  const packet = initialPacket(view, {
    QuoteNumber: quoteNumber,
    ManualID: String(manualId),
    UWQuoteCode: "A",
    UWStatusCode: "P",
    AgentCode: agent?.agentCode ?? "",
    NumberOfRisks: "0",
  });
  const firstPage = availablePages(view, packet, userType)[0];
  await prisma.quote.update({
    where: { id: draft.id },
    data: { quoteNumber, data: packet, currentPageId: firstPage?.id ?? null, ...summaryColumns(packet) },
  });
  await audit("quote.created", { userId: actor.userId, entity: "quote", entityId: draft.id, detail: quoteNumber });
  return { id: draft.id, pageId: firstPage?.id ?? null };
}

export async function submitPage(
  input: { quoteId: number; pageId: number; values: Record<string, string>; navigation: Navigation; actions: string[]; risk?: number },
  actor: Actor,
): Promise<SubmitResult> {
  const fail = (message: string, errors: Record<string, string> = {}): SubmitResult => ({ ok: false, message, errors });
  const quote = await prisma.quote.findFirst({
    where: { id: input.quoteId, ...quoteScope(actor) },
    include: { manual: { select: { maxRisks: true } } },
  });
  if (!quote || !quote.viewId) return fail("This quote could not be found.");
  const wants = (name: string) => input.actions.some((action) => action.toUpperCase() === name);
  const here = `/quotes/${quote.id}/${input.pageId}`;

  if (quote.statusCode === "B") {
    if (wants("RESETESIGN")) {
      const packet = await cancelEsign(quote.id, asPacket(quote.data), actor.userId);
      await prisma.quote.update({ where: { id: quote.id }, data: { statusCode: "P", statusDate: new Date(), data: packet } });
      return { ok: true, redirectTo: here, packet };
    }
    if (wants("RESENDESIGN")) {
      const resent = await resendEsign(quote.id, actor.userId);
      return resent.ok ? { ok: true, redirectTo: here, packet: asPacket(quote.data) } : fail(resent.message);
    }
    return fail("This quote is out for e-sign. Cancel the e-sign to change it.");
  }
  if (quote.statusCode !== "P") return fail("This quote is locked and can no longer be changed.");

  const view = await loadView(quote.viewId);
  if (!view) return fail("The form for this quote is no longer available.");
  const userType = userTypeOf(actor.role);
  const original = asPacket(quote.data);
  const page = view.pages.find((candidate) => candidate.id === input.pageId);

  const result = runEngine({
    view,
    packet: original,
    pageId: input.pageId,
    values: input.values,
    navigation: input.navigation,
    actions: input.actions,
    userType,
    risk: input.risk,
    maxRisks: quote.manual.maxRisks,
  });

  const answersChanged = result.changed && !pageHasWidget(page, ["paymentwidget", "esignstatus"]);
  if (original.PaymentStatus === "PAID" && answersChanged) {
    return fail("The premium for this quote has been paid, so its answers can no longer be changed.");
  }

  if (Object.keys(result.errors).length > 0) {
    await prisma.quote.update({
      where: { id: quote.id },
      data: { data: result.packet, ...summaryColumns(result.packet), ...(answersChanged ? { ratingValid: false } : {}) },
    });
    return fail("Some answers need attention before you can continue.", result.errors);
  }

  const has = (name: string) => result.actions.some((action) => action.toUpperCase() === name);
  let packet = result.packet;
  let ratingValid = answersChanged ? false : quote.ratingValid;
  let totalPremium = answersChanged ? null : quote.totalPremium === null ? null : Number(quote.totalPremium);
  let statusCode = quote.statusCode;
  let targetPageId = result.targetPageId;
  let redirectTo = "";
  let problem = "";
  if (answersChanged) packet.ValidRating = "false";

  if (has("RATE") && packet.PaymentStatus !== "PAID") {
    const rating = await rateAndStore(quote.id, quote.manualId, packet);
    packet = rating.packet;
    ratingValid = rating.ok;
    totalPremium = rating.ok ? rating.total : null;
  }

  if (has("PAY")) {
    if (!ratingValid || totalPremium === null) {
      problem = "The premium must be calculated before payment can be taken.";
    } else {
      const paid = await takePayment(
        {
          quoteId: quote.id,
          quoteNumber: quote.quoteNumber,
          amount: totalPremium,
          method: packet.PaymentMethod ?? "",
          simulateFailure: input.values.PaymentTestOutcome === "FAIL",
          userId: actor.userId,
        },
        packet,
      );
      packet = paid.packet;
      if (!paid.ok) problem = paid.message;
    }
    if (problem) targetPageId = input.pageId;
  }

  if (!problem && has("ESIGN")) {
    if (!ratingValid) problem = "The premium must be calculated before documents can be sent for signing.";
    else if (paymentComesFirst(view, input.pageId) && packet.PaymentStatus !== "PAID") problem = "The premium must be paid before documents can be sent for signing.";
    else {
      const started = await startEsign(quote.id, quote.manualId, packet, actor.userId);
      if (started.ok) {
        packet = started.data;
        statusCode = "B";
      } else {
        problem = started.message;
      }
    }
    if (problem) targetPageId = input.pageId;
  }

  if (has("EXITANDDELETE")) {
    if (packet.PaymentStatus === "PAID") {
      problem = "A paid quote cannot be deleted.";
      targetPageId = input.pageId;
    } else {
      statusCode = "X";
      packet.UWStatusCode = "X";
      redirectTo = "/quotes";
    }
  } else if (has("EXIT")) {
    redirectTo = "/quotes";
  }

  let viewId = quote.viewId;
  if (result.targetViewId && !problem) {
    const nextView = await loadView(result.targetViewId);
    if (nextView && nextView.manualId === view.manualId) {
      viewId = nextView.id;
      const pages = availablePages(nextView, packet, userType);
      targetPageId = pages.find((candidate) => candidate.id === targetPageId)?.id ?? pages[0]?.id ?? targetPageId;
    }
  }

  const targetOrder = view.pages.find((candidate) => candidate.id === targetPageId)?.order ?? 0;
  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      data: packet,
      viewId,
      currentPageId: targetPageId,
      furthestPageOrder: Math.max(quote.furthestPageOrder, targetOrder),
      statusCode,
      ...(statusCode !== quote.statusCode ? { statusDate: new Date() } : {}),
      ratingValid,
      totalPremium,
      ...summaryColumns(packet),
    },
  });

  if (!problem && has("BIND")) {
    if (paymentComesFirst(view, input.pageId) && packet.PaymentStatus !== "PAID") {
      problem = "The premium must be paid before the policy can be issued.";
    } else {
      const issued = await issuePolicy(quote.id, actor.userId);
      if (!issued.ok) problem = issued.message;
      else packet = asPacket((await prisma.quote.findUniqueOrThrow({ where: { id: quote.id }, select: { data: true } })).data);
    }
  }

  if (problem) return fail(problem);
  return { ok: true, redirectTo: redirectTo || `/quotes/${quote.id}/${targetPageId}`, packet };
}
