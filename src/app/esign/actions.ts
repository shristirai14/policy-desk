"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { sendSigningCode, signDocument, verifySigningCode } from "@/lib/esign";

export type SigningResult = { ok: true; complete?: boolean } | { ok: false; message: string };

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/);

async function clientIp() {
  const list = await headers();
  return (list.get("x-forwarded-for")?.split(",")[0] ?? list.get("x-real-ip") ?? "unknown").trim().slice(0, 45);
}

export async function sendCodeAction(token: string): Promise<SigningResult> {
  if (!tokenSchema.safeParse(token).success) return { ok: false, message: "This signing link is not valid." };
  const result = await sendSigningCode(token, await clientIp());
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

const verifySchema = z.object({
  token: tokenSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email."),
  signatureText: z.string().trim().min(2, "Type your full name as your signature.").max(80),
  initialsText: z.string().trim().min(1, "Enter your initials.").max(6),
  consent: z.literal(true, { message: "Tick the box to agree to sign electronically." }),
});

export async function verifyCodeAction(input: z.input<typeof verifySchema>): Promise<SigningResult> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const result = await verifySigningCode(parsed.data, await clientIp());
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/esign/${parsed.data.token}`);
  return { ok: true };
}

const signSchema = z.object({
  token: tokenSchema,
  documentId: z.number().int().positive(),
  agreed: z.literal(true, { message: "Tick the box to confirm you have read the document." }),
});

export async function signAction(input: z.input<typeof signSchema>): Promise<SigningResult> {
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const result = await signDocument(parsed.data.token, parsed.data.documentId, await clientIp());
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/esign/${parsed.data.token}`);
  return { ok: true, complete: result.data.complete };
}
