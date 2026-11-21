import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isRole, ROLE_LABELS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { CreateUserDialog } from "./create-user-dialog";
import { UserRowActions } from "./user-row-actions";

export const metadata: Metadata = { title: "Users" };
export const instant = false;

export default async function UsersPage() {
  const session = await requireRole("admin");
  const [users, agents] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.agent.findMany(),
  ]);
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Accounts are created here. New users receive an email to set their own password.
          </p>
        </div>
        <CreateUserDialog />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const agent = user.agentId ? agentById.get(user.agentId) : undefined;
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{isRole(user.role) ? ROLE_LABELS[user.role] : "Agent"}</TableCell>
                  <TableCell>{agent ? `${agent.agentCode} - ${agent.name}` : ""}</TableCell>
                  <TableCell>
                    {user.banned ? <Badge variant="destructive">Deactivated</Badge> : <Badge variant="success">Active</Badge>}
                  </TableCell>
                  <TableCell>
                    <UserRowActions userId={user.id} active={!user.banned} isSelf={user.id === session.user.id} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
