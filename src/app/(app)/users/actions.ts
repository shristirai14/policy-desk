"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const createUserSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the user's name."),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    role: z.enum(["admin", "underwriter", "agent"]),
    agentCode: z.string().trim().toUpperCase().max(20).optional(),
    agencyName: z.string().trim().max(100).optional(),
  })
  .refine((value) => value.role !== "agent" || Boolean(value.agentCode), {
    message: "An agent code is required for agents.",
    path: ["agentCode"],
  });

export type CreateUserInput = z.input<typeof createUserSchema>;

async function sendSetPasswordEmail(email: string) {
  await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
}

export async function createUserAction(input: CreateUserInput): Promise<ActionResult> {
  const admin = await requireRole("admin");
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { name, email, role, agentCode, agencyName } = parsed.data;

  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, message: "A user with this email already exists." };
  }

  const created = await auth.api.createUser({
    body: { name, email, role, password: randomBytes(24).toString("base64url") },
    headers: await headers(),
  });

  let agentId: string | null = null;
  if (role === "agent" && agentCode) {
    const agent = await prisma.agent.upsert({
      where: { agentCode },
      update: {},
      create: { agentCode, name: agencyName || name, email },
    });
    agentId = agent.id;
  }

  await prisma.user.update({
    where: { id: created.user.id },
    data: { emailVerified: true, twoFactorEnabled: true, agentId },
  });

  await sendSetPasswordEmail(email);
  await audit("user.created", { userId: admin.user.id, entity: "user", entityId: created.user.id, detail: `${email} as ${role}` });
  revalidatePath("/users");
  return { ok: true, message: `Account created. A set-password email was sent to ${email}.` };
}

export async function resendInviteAction(userId: string): Promise<ActionResult> {
  await requireRole("admin");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, message: "User not found." };
  await sendSetPasswordEmail(user.email);
  return { ok: true, message: `Set-password email sent to ${user.email}.` };
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  const session = await requireRole("admin");
  if (userId === session.user.id) return { ok: false, message: "You cannot deactivate your own account." };
  const requestHeaders = await headers();
  if (active) {
    await auth.api.unbanUser({ body: { userId }, headers: requestHeaders });
  } else {
    await auth.api.banUser({ body: { userId, banReason: "Deactivated by administrator" }, headers: requestHeaders });
  }
  await audit(active ? "user.reactivated" : "user.deactivated", { userId: session.user.id, entity: "user", entityId: userId });
  revalidatePath("/users");
  return { ok: true, message: active ? "User reactivated." : "User deactivated and signed out." };
}
