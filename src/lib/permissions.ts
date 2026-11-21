import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const ac = createAccessControl(defaultStatements);

export const roles = {
  admin: ac.newRole(adminAc.statements),
  underwriter: ac.newRole({ user: [], session: [] }),
  agent: ac.newRole({ user: [], session: [] }),
};

export type Role = keyof typeof roles;

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  underwriter: "Underwriter",
  agent: "Agent",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && value in roles;
}
