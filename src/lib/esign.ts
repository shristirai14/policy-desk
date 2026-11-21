import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { audit } from "@/lib/audit";
import { longDate, money, renderDocument, type PremiumLine } from "@/lib/documents/render";
import { sha256, stampSignature } from "@/lib/documents/sign";
import { parseBlocks } from "@/lib/documents/templates";
import { APP_NAME, sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { evaluateCondition } from "@/lib/ua/conditions";
import { getValue, makeContext } from "@/lib/ua/packet";
import type { Packet } from "@/lib/ua/types";

export type ServiceResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

const OTP_MINUTES = 10;
const OTP_RESEND_SECONDS = 45;
const OTP_MAX_ATTEMPTS = 5;

function baseUrl() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function signingLink(token: string) {
  return `${baseUrl()}/esign/${token}`;
}

function hashOtp(token: string, code: string) {
  return createHash("sha256").update(`${token}:${code}`).digest("hex");
}

function asPacket(value: unknown): Packet {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item === null ? "" : String(item)]));
}

export function expirationDate(effective: string) {
  const start = new Date(`${effective}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

export function signerOf(packet: Packet) {
  const name = [getValue(packet, "FirstName"), getValue(packet, "LastName")].filter(Boolean).join(" ") || getValue(packet, "ApplicantName");
  return { name, email: getValue(packet, "Email") };
}

async function premiumLines(quoteId: number): Promise<PremiumLine[]> {
  const rows = await prisma.quoteRatingResult.findMany({ where: { quoteId }, orderBy: { seq: "asc" } });
  return rows.map((row) => ({ risk: row.risk, description: row.description ?? row.fieldName, amount: Number(row.premiumAmount) }));
}

async function sendInvitation(token: string, name: string, email: string, quoteNumber: string, titles: string[]) {
  await sendMail({
    to: email,
    subject: `Documents to sign for your motor insurance ${quoteNumber}`,
    heading: "Your documents are ready to sign",
    lines: [
      `Hello ${name},`,
      `Your agent has prepared ${titles.length} document(s) for quote ${quoteNumber}: ${titles.join(", ")}.`,
      "Open the link below, confirm your identity with a code we email you, then read and sign each document. No account is needed.",
    ],
    action: { label: "Review and sign", url: signingLink(token) },
  });
}

export async function startEsign(quoteId: number, manualId: number, packet: Packet, userId: string): Promise<ServiceResult<Packet>> {
  const signer = signerOf(packet);
  if (!signer.name || !signer.email) return { ok: false, message: "The proposer's name and email are needed before documents can be sent for signing." };

  const ctx = makeContext(packet, { userType: "internal" });
  const templates = (await prisma.documentTemplate.findMany({ where: { manualId }, orderBy: { sortOrder: "asc" } })).filter((template) =>
    evaluateCondition(template.condition, ctx),
  );
  if (templates.length === 0) return { ok: false, message: "This product has no documents set up for signing." };

  const year = (packet.EffectiveDate ?? "").slice(0, 4) || String(new Date().getUTCFullYear());
  const next: Packet = {
    ...packet,
    PolicyNumber: packet.PolicyNumber || `PD/${year}/${String(quoteId).padStart(6, "0")}`,
    ExpirationDate: expirationDate(packet.EffectiveDate ?? ""),
    UWStatusCode: "B",
    ESignStatus: "PENDING",
  };
  const premium = await premiumLines(quoteId);
  const total = Number(next.TotalPremium) || 0;
  const rendered = await Promise.all(
    templates.map(async (template) => ({
      template,
      pdf: await renderDocument({ title: template.title, blocks: parseBlocks(template.body), packet: next, premium, total }),
    })),
  );

  const token = randomBytes(24).toString("base64url");
  await prisma.$transaction(async (tx) => {
    await tx.esignDocument.deleteMany({ where: { quoteId } });
    await tx.esignAuthorization.deleteMany({ where: { quoteId } });
    await tx.esignAuthorization.create({ data: { id: token, quoteId, contactName: signer.name, contactEmail: signer.email } });
    for (const item of rendered) {
      await tx.esignDocument.create({
        data: {
          quoteId,
          templateId: item.template.id,
          title: item.template.title,
          unsignedPdf: item.pdf,
          sha256: sha256(item.pdf),
          signatures: { create: { authorizationId: token } },
        },
      });
    }
  });

  await sendInvitation(token, signer.name, signer.email, next.QuoteNumber ?? "", templates.map((template) => template.title));
  await audit("esign.started", { userId, entity: "quote", entityId: quoteId, detail: `${templates.length} document(s) to ${signer.email}` });
  return { ok: true, data: next };
}

export async function cancelEsign(quoteId: number, packet: Packet, userId: string): Promise<Packet> {
  await prisma.$transaction([prisma.esignDocument.deleteMany({ where: { quoteId } }), prisma.esignAuthorization.deleteMany({ where: { quoteId } })]);
  await audit("esign.cancelled", { userId, entity: "quote", entityId: quoteId });
  return { ...packet, UWStatusCode: "P", ESignStatus: "" };
}

export async function resendEsign(quoteId: number, userId: string): Promise<ServiceResult> {
  const authorization = await prisma.esignAuthorization.findFirst({
    where: { quoteId, statusCode: { not: "C" } },
    include: { quote: { select: { quoteNumber: true } }, signatures: { include: { document: { select: { title: true } } } } },
  });
  if (!authorization) return { ok: false, message: "There is no signing request to resend." };
  await sendInvitation(
    authorization.id,
    authorization.contactName,
    authorization.contactEmail,
    authorization.quote.quoteNumber,
    authorization.signatures.map((signature) => signature.document.title),
  );
  await audit("esign.resent", { userId, entity: "quote", entityId: quoteId });
  return { ok: true, data: undefined };
}

export async function loadSigning(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return prisma.esignAuthorization.findUnique({
    where: { id: token },
    include: {
      quote: { select: { id: true, quoteNumber: true, statusCode: true, data: true, policy: { select: { policyNumber: true } } } },
      signatures: { orderBy: { id: "asc" }, include: { document: { select: { id: true, title: true, statusCode: true } } } },
    },
  });
}

export async function sendSigningCode(token: string, ipAddress: string): Promise<ServiceResult> {
  const authorization = await loadSigning(token);
  if (!authorization || authorization.quote.statusCode !== "B") return { ok: false, message: "This signing link is no longer active." };
  if (authorization.statusCode !== "N") return { ok: false, message: "Your identity is already confirmed." };
  if (authorization.otpSentAt && Date.now() - authorization.otpSentAt.getTime() < OTP_RESEND_SECONDS * 1000) {
    return { ok: false, message: `A code was just sent. Wait ${OTP_RESEND_SECONDS} seconds before asking for another.` };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.esignAuthorization.update({
    where: { id: token },
    data: { otpHash: hashOtp(token, code), otpExpiresAt: new Date(Date.now() + OTP_MINUTES * 60_000), otpSentAt: new Date(), otpAttempts: 0 },
  });
  await sendMail({
    to: authorization.contactEmail,
    subject: `${code} is your ${APP_NAME} signing code`,
    heading: "Your signing code",
    lines: [`Enter this code to confirm your identity for quote ${authorization.quote.quoteNumber}. It expires in ${OTP_MINUTES} minutes.`],
    code,
  });
  await audit("esign.code_sent", { entity: "quote", entityId: authorization.quoteId, ipAddress });
  return { ok: true, data: undefined };
}

export async function verifySigningCode(
  input: { token: string; code: string; signatureText: string; initialsText: string },
  ipAddress: string,
): Promise<ServiceResult> {
  const authorization = await loadSigning(input.token);
  if (!authorization || authorization.quote.statusCode !== "B") return { ok: false, message: "This signing link is no longer active." };
  if (authorization.statusCode !== "N") return { ok: true, data: undefined };
  if (!authorization.otpHash || !authorization.otpExpiresAt || authorization.otpExpiresAt < new Date()) {
    return { ok: false, message: "That code has expired. Ask for a new one." };
  }
  if (authorization.otpAttempts >= OTP_MAX_ATTEMPTS) return { ok: false, message: "Too many wrong attempts. Ask for a new code." };

  const expected = Buffer.from(authorization.otpHash, "hex");
  const actual = Buffer.from(hashOtp(input.token, input.code.trim()), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await prisma.esignAuthorization.update({ where: { id: input.token }, data: { otpAttempts: { increment: 1 } } });
    return { ok: false, message: "That code is not correct." };
  }
  await prisma.esignAuthorization.update({
    where: { id: input.token },
    data: {
      statusCode: "A",
      authorizedAt: new Date(),
      ipAddress,
      otpHash: null,
      otpExpiresAt: null,
      signatureText: input.signatureText.trim().slice(0, 80),
      initialsText: input.initialsText.trim().slice(0, 6).toUpperCase(),
    },
  });
  await audit("esign.authorized", { entity: "quote", entityId: authorization.quoteId, ipAddress });
  return { ok: true, data: undefined };
}

export async function signDocument(token: string, documentId: number, ipAddress: string): Promise<ServiceResult<{ complete: boolean }>> {
  const authorization = await loadSigning(token);
  if (!authorization || authorization.quote.statusCode !== "B") return { ok: false, message: "This signing link is no longer active." };
  if (authorization.statusCode === "N") return { ok: false, message: "Confirm your identity before signing." };
  const signature = authorization.signatures.find((item) => item.document.id === documentId);
  if (!signature) return { ok: false, message: "That document is not part of this signing request." };

  if (signature.statusCode !== "C") {
    const document = await prisma.esignDocument.findUniqueOrThrow({ where: { id: documentId } });
    if (!document.unsignedPdf) return { ok: false, message: "This document could not be loaded." };
    const signedAt = new Date();
    const packet = asPacket(authorization.quote.data);
    const signedPdf = await stampSignature(document.unsignedPdf, {
      documentTitle: document.title,
      signerName: authorization.contactName,
      signerEmail: authorization.contactEmail,
      signatureText: authorization.signatureText || authorization.contactName,
      initialsText: authorization.initialsText ?? "",
      authorizedAt: authorization.authorizedAt ?? signedAt,
      signedAt,
      ipAddress,
      reference: `Policy ${packet.PolicyNumber ?? ""}, quote ${authorization.quote.quoteNumber}`,
    });
    await prisma.$transaction([
      prisma.esignDocument.update({ where: { id: documentId }, data: { signedPdf, sha256: sha256(signedPdf), statusCode: "C" } }),
      prisma.esignSignature.update({ where: { id: signature.id }, data: { statusCode: "C", signedAt, ipAddress } }),
    ]);
    await audit("esign.signed", { entity: "quote", entityId: authorization.quoteId, detail: document.title, ipAddress });
  }

  const remaining = await prisma.esignSignature.count({ where: { authorizationId: token, statusCode: { not: "C" } } });
  if (remaining > 0) return { ok: true, data: { complete: false } };

  await prisma.esignAuthorization.update({ where: { id: token }, data: { statusCode: "C", completedAt: new Date() } });
  const open = await prisma.esignAuthorization.count({ where: { quoteId: authorization.quoteId, statusCode: { not: "C" } } });
  if (open === 0) await issuePolicy(authorization.quoteId, null);
  return { ok: true, data: { complete: true } };
}

export async function issuePolicy(quoteId: number, userId: string | null): Promise<ServiceResult<{ policyNumber: string }>> {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { policy: true, esignDocuments: true } });
  if (!quote) return { ok: false, message: "Quote not found." };
  if (quote.policy) return { ok: true, data: { policyNumber: quote.policy.policyNumber } };
  if (!quote.ratingValid || quote.totalPremium === null) return { ok: false, message: "The quote must have a valid premium before a policy can be issued." };

  const packet = asPacket(quote.data);
  const effective = packet.EffectiveDate ?? "";
  const expiration = expirationDate(effective);
  if (!expiration) return { ok: false, message: "The policy start date is missing." };
  const policyNumber = packet.PolicyNumber || `PD/${effective.slice(0, 4)}/${String(quoteId).padStart(6, "0")}`;
  const next: Packet = { ...packet, PolicyNumber: policyNumber, ExpirationDate: expiration, UWStatusCode: "A", ESignStatus: packet.ESignStatus ? "COMPLETE" : "" };

  await prisma.$transaction([
    prisma.policy.create({
      data: {
        policyNumber,
        quoteId,
        effectiveDate: new Date(`${effective}T00:00:00Z`),
        expirationDate: new Date(`${expiration}T00:00:00Z`),
        totalPremium: quote.totalPremium,
        snapshot: next,
      },
    }),
    prisma.quote.update({ where: { id: quoteId }, data: { statusCode: "A", statusDate: new Date(), data: next } }),
  ]);
  await audit("policy.issued", { userId, entity: "quote", entityId: quoteId, detail: policyNumber });

  const signer = signerOf(next);
  if (signer.email) {
    await sendMail({
      to: signer.email,
      subject: `Your motor insurance policy ${policyNumber}`,
      heading: "Your policy is issued",
      lines: [
        `Hello ${signer.name},`,
        `Policy ${policyNumber} is in force from ${longDate(effective)} to midnight of ${longDate(expiration)}.`,
        `Total premium paid: ${money(Number(quote.totalPremium))}.`,
        quote.esignDocuments.length > 0 ? "Your signed documents are attached." : "Your agent will share your policy documents.",
      ],
      attachments: quote.esignDocuments
        .filter((document) => document.signedPdf)
        .map((document) => ({ filename: `${document.title.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`, content: Buffer.from(document.signedPdf!) })),
    });
  }
  return { ok: true, data: { policyNumber } };
}
