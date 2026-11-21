"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function removeAuthenticatorAction(password: string) {
  const session = await requireSession();
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "credential" },
  });
  const ctx = await auth.$context;
  const valid = account?.password ? await ctx.password.verify({ hash: account.password, password }) : false;
  if (!valid) return { ok: false as const, message: "The password is not correct." };
  await prisma.twoFactor.deleteMany({ where: { userId: session.user.id } });
  revalidatePath("/account");
  return { ok: true as const, message: "Authenticator removed. Sign-in codes will be sent by email." };
}
