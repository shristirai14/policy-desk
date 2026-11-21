import type { Metadata } from "next";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Audit log" };
export const instant = false;

const LABELS: Record<string, string> = {
  "quote.created": "Quote created",
  "payment.success": "Payment received",
  "payment.failed": "Payment declined",
  "esign.started": "E-sign started",
  "esign.resent": "Signing email resent",
  "esign.cancelled": "E-sign cancelled",
  "esign.code_sent": "Signing code sent",
  "esign.authorized": "Signer confirmed identity",
  "esign.signed": "Document signed",
  "policy.issued": "Policy issued",
  "user.created": "User created",
  "user.deactivated": "User deactivated",
  "user.reactivated": "User reactivated",
};

const TIME = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default async function AuditPage() {
  await requireRole("admin");
  const rows = await prisma.auditLog.findMany({ orderBy: { id: "desc" }, take: 200 });
  const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameOf = new Map(users.map((user) => [user.id, user.name]));

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">The most recent 200 events: quotes, payments, e-sign and policy issue.</p>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>By</TableHead>
              <TableHead>On</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>IP address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nothing has been recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{TIME.format(row.createdAt)}</TableCell>
                  <TableCell>{LABELS[row.action] ?? row.action}</TableCell>
                  <TableCell>{row.userId ? (nameOf.get(row.userId) ?? "Removed user") : "Insured (signing link)"}</TableCell>
                  <TableCell>
                    {row.entity === "quote" && row.entityId ? (
                      <Link href={`/quotes/${row.entityId}`} className="underline-offset-4 hover:underline">
                        Quote {row.entityId}
                      </Link>
                    ) : (
                      [row.entity, row.entityId].filter(Boolean).join(" ")
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">{row.detail}</TableCell>
                  <TableCell>{row.ipAddress}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
