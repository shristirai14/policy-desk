import "dotenv/config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/permissions";
import { seedPrivateCarManual } from "./seed-manual";

async function ensureUser(input: {
  email: string;
  password: string;
  name: string;
  role: Role;
  agentId?: string;
}) {
  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(input.email, { includeAccounts: false });
  if (existing) return existing.user;
  const user = await ctx.internalAdapter.createUser({
    email: input.email,
    name: input.name,
    emailVerified: true,
    role: input.role,
    twoFactorEnabled: true,
    agentId: input.agentId,
  }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(input.password),
  });
  return user;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main() {
  const agent = await prisma.agent.upsert({
    where: { agentCode: "AG0001" },
    update: {},
    create: {
      agentCode: "AG0001",
      name: "Demo Insurance Agency",
      email: requireEnv("SEED_AGENT_EMAIL"),
      city: "Mumbai",
    },
  });

  await ensureUser({
    email: requireEnv("SEED_ADMIN_EMAIL"),
    password: requireEnv("SEED_ADMIN_PASSWORD"),
    name: "System Administrator",
    role: "admin",
  });

  await ensureUser({
    email: requireEnv("SEED_AGENT_EMAIL"),
    password: requireEnv("SEED_AGENT_PASSWORD"),
    name: "Demo Agent",
    role: "agent",
    agentId: agent.id,
  });

  await seedPrivateCarManual();

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
