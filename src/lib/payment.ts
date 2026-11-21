import "server-only";
import { randomBytes } from "node:crypto";
import { audit } from "@/lib/audit";
import { money } from "@/lib/documents/render";
import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { getValue } from "@/lib/ua/packet";
import type { Packet } from "@/lib/ua/types";

export const PAYMENT_METHODS: Record<string, string> = { UPI: "UPI", CARD: "Card", NETBANKING: "Net banking" };

export async function takePayment(
  input: { quoteId: number; quoteNumber: string; amount: number; method: string; simulateFailure: boolean; userId: string },
  packet: Packet,
): Promise<{ ok: true; packet: Packet } | { ok: false; message: string; packet: Packet }> {
  const method = input.method in PAYMENT_METHODS ? input.method : "";
  if (!method) return { ok: false, message: "Choose how the premium is being paid.", packet };
  if (packet.PaymentStatus === "PAID") return { ok: false, message: "This quote has already been paid.", packet };

  const reference = `PAY${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;
  const success = !input.simulateFailure;
  await prisma.payment.create({
    data: {
      quoteId: input.quoteId,
      amount: input.amount,
      method,
      status: success ? "SUCCESS" : "FAILED",
      reference,
      paidAt: success ? new Date() : null,
    },
  });
  await audit(success ? "payment.success" : "payment.failed", {
    userId: input.userId,
    entity: "quote",
    entityId: input.quoteId,
    detail: `${PAYMENT_METHODS[method]} ${money(input.amount)} ${reference}`,
  });

  if (!success) {
    return { ok: false, message: "The payment was declined. No money was taken. Try again or use another method.", packet: { ...packet, PaymentStatus: "FAILED" } };
  }

  const email = getValue(packet, "Email");
  if (email) {
    await sendMail({
      to: email,
      subject: `Payment received for quote ${input.quoteNumber}`,
      heading: "Payment received",
      lines: [
        `We received ${money(input.amount)} by ${PAYMENT_METHODS[method]} for quote ${input.quoteNumber}.`,
        `Payment reference: ${reference}.`,
        "This is a demonstration payment. No money was taken.",
      ],
    });
  }
  return {
    ok: true,
    packet: { ...packet, PaymentStatus: "PAID", PaymentReference: reference, PaymentAmount: String(input.amount), PaymentDate: new Date().toISOString().slice(0, 10) },
  };
}
