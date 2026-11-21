import "server-only";
import { prisma } from "@/lib/prisma";

export async function audit(
  action: string,
  options: { userId?: string | null; entity?: string; entityId?: string | number; detail?: string; ipAddress?: string | null } = {},
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId: options.userId ?? null,
        entity: options.entity ?? null,
        entityId: options.entityId === undefined ? null : String(options.entityId),
        detail: options.detail?.slice(0, 500) ?? null,
        ipAddress: options.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] could not write", action, error);
  }
}
