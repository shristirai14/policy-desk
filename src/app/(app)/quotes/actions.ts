"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession, roleOf } from "@/lib/session";
import { createQuote, submitPage, type Actor } from "@/lib/ua/pipeline";
import type { SubmitResult } from "@/lib/ua/types";

async function currentActor(): Promise<Actor> {
  const session = await requireSession();
  return { userId: session.user.id, role: roleOf(session), agentId: session.user.agentId ?? null };
}

export async function createQuoteAction(formData: FormData) {
  const manualId = Number(formData.get("manualId"));
  const actor = await currentActor();
  const created = Number.isInteger(manualId) ? await createQuote(manualId, actor) : null;
  if (!created) redirect("/quotes/new?error=1");
  redirect(created.pageId ? `/quotes/${created.id}/${created.pageId}` : `/quotes/${created.id}`);
}

const submitSchema = z.object({
  quoteId: z.number().int().positive(),
  pageId: z.number().int().positive(),
  values: z.record(z.string(), z.string().max(2000)),
  navigation: z.enum(["next", "prev", "stay"]),
  actions: z.array(z.string().max(40)).max(10),
  risk: z.number().int().min(1).max(50).optional(),
});

export async function submitPageAction(input: z.input<typeof submitSchema>): Promise<SubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "The form could not be read. Reload the page and try again.", errors: {} };
  return submitPage(parsed.data, await currentActor());
}
