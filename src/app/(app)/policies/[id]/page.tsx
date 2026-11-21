import { ArrowLeft, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireSession, roleOf } from "@/lib/session";
import { formatCalendarDate, formatDate, formatMoney } from "@/lib/status";
import { riskCount } from "@/lib/ua/engine";
import { asPacket, quoteScope } from "@/lib/ua/pipeline";

export const metadata: Metadata = { title: "Policy" };
export const instant = false;

export default async function PolicyPage({ params }: PageProps<"/policies/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const policy = await prisma.policy.findFirst({
    where: { id: Number(id) || 0, quote: quoteScope({ userId: session.user.id, role: roleOf(session), agentId: null }) },
    include: {
      quote: {
        include: {
          manual: { select: { name: true } },
          agent: { select: { agentCode: true, name: true } },
          ratingResults: { orderBy: { seq: "asc" } },
          esignDocuments: { orderBy: { id: "asc" }, select: { id: true, title: true, statusCode: true } },
          payments: { where: { status: "SUCCESS" }, orderBy: { id: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!policy) notFound();

  const packet = asPacket(policy.snapshot);
  const quote = policy.quote;
  const payment = quote.payments[0];
  const expired = policy.expirationDate < new Date();
  const vehicles = Array.from({ length: riskCount(packet) }, (_, index) => index + 1);
  const address = [packet.Address1, packet.Address2, packet.City, packet.State, packet.Pincode].filter(Boolean).join(", ");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/policies" className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline">
            <ArrowLeft className="size-3.5" />
            All policies
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Policy {policy.policyNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {quote.manual.name} for {quote.applicantName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={expired ? "outline" : "success"}>{expired ? "Expired" : "Active"}</Badge>
          <Button nativeButton={false} variant="outline" render={<Link href={`/quotes/${quote.id}`} />}>
            Open quote {quote.quoteNumber}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Period</dt>
              <dd>
                {formatCalendarDate(policy.effectiveDate)} to {formatCalendarDate(policy.expirationDate)}
              </dd>
              <dt className="text-muted-foreground">Issued</dt>
              <dd>{formatDate(policy.createdAt)}</dd>
              <dt className="text-muted-foreground">Total premium</dt>
              <dd className="tabular-nums">{formatMoney(policy.totalPremium)}</dd>
              <dt className="text-muted-foreground">Payment</dt>
              <dd>{payment ? `${payment.method}, reference ${payment.reference}` : "Not recorded"}</dd>
              <dt className="text-muted-foreground">Agent</dt>
              <dd>{quote.agent ? `${quote.agent.agentCode} - ${quote.agent.name}` : "Direct"}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insured</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{quote.applicantName}</dd>
              <dt className="text-muted-foreground">Mobile</dt>
              <dd>{quote.applicantMobile}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{quote.applicantEmail}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd>{address}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {vehicles.map((risk) => (
                <li key={risk} className="rounded-lg border p-3">
                  <p className="font-medium">
                    {packet[`RegistrationNumber_${risk}`]} {packet[`Make_${risk}`]} {packet[`Model_${risk}`]}
                  </p>
                  <p className="text-muted-foreground">
                    {packet[`VariantName_${risk}`]}, insured declared value {formatMoney(packet[`IDV_${risk}`])}, premium before tax{" "}
                    {formatMoney(packet[`RiskPremium_${risk}`])}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Signed copies were also emailed to the insured.</CardDescription>
          </CardHeader>
          <CardContent>
            {quote.esignDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">This policy was issued without e-sign documents.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {quote.esignDocuments.map((document) => (
                  <li key={document.id}>
                    <Link href={`/api/documents/${document.id}`} target="_blank" className="flex items-center gap-2 text-sm underline-offset-4 hover:underline">
                      <FileText className="size-4 text-muted-foreground" />
                      {document.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Premium breakup</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {quote.ratingResults.map((row) => (
                <tr key={row.id} className="border-t first:border-t-0">
                  <td className="py-1.5 text-muted-foreground">{row.risk === 0 ? "Policy" : `Vehicle ${row.risk}`}</td>
                  <td className="py-1.5">{row.description}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(row.premiumAmount)}</td>
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <td className="py-2" colSpan={2}>
                  Total premium
                </td>
                <td className="py-2 text-right tabular-nums">{formatMoney(policy.totalPremium)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
