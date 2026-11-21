import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { QuoteForm } from "@/components/ua/quote-form";
import { Badge } from "@/components/ui/badge";
import { signingLink } from "@/lib/esign";
import { prisma } from "@/lib/prisma";
import { requireSession, roleOf } from "@/lib/session";
import { statusOf } from "@/lib/status";
import { availablePages } from "@/lib/ua/engine";
import { loadView } from "@/lib/ua/load";
import { asPacket, quoteScope, userTypeOf } from "@/lib/ua/pipeline";

export const metadata: Metadata = { title: "Quote" };
export const instant = false;

export default async function QuotePage({ params }: PageProps<"/quotes/[id]/[[...page]]">) {
  const { id, page: pageParam } = await params;
  const session = await requireSession();
  const role = roleOf(session);
  const quoteId = Number(id);
  if (!Number.isInteger(quoteId)) notFound();

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...quoteScope({ userId: session.user.id, role, agentId: null }) },
    include: {
      manual: { select: { name: true, maxRisks: true } },
      ratingResults: { orderBy: { seq: "asc" } },
      esignDocuments: { orderBy: { id: "asc" }, select: { id: true, title: true, statusCode: true } },
      esignAuthorizations: { select: { id: true, contactName: true, contactEmail: true, statusCode: true } },
      policy: { select: { id: true, policyNumber: true } },
    },
  });
  if (!quote || !quote.viewId) notFound();
  const view = await loadView(quote.viewId);
  if (!view) notFound();

  const userType = userTypeOf(role);
  const packet = asPacket(quote.data);
  const pages = availablePages(view, packet, userType);
  if (pages.length === 0) notFound();

  const requested = pageParam?.[0] ? Number(pageParam[0]) : (quote.currentPageId ?? pages[0].id);
  const index = pages.findIndex((candidate) => candidate.id === requested);
  const locked = quote.statusCode !== "P";
  if (index === -1 || (!locked && pages[index].order > quote.furthestPageOrder && index !== 0)) {
    const fallback = pages.find((candidate) => candidate.id === quote.currentPageId) ?? pages[0];
    redirect(`/quotes/${quote.id}/${fallback.id}`);
  }
  const page = pages[index];
  const status = statusOf(quote.statusCode);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quote {quote.quoteNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {quote.manual.name}
            {quote.applicantName ? ` for ${quote.applicantName}` : ""}
          </p>
        </div>
        <Badge variant={status.tone}>{status.label}</Badge>
      </div>
      <QuoteForm
        key={page.id}
        quoteId={quote.id}
        page={page}
        steps={pages.filter((candidate) => candidate.milestone).map((candidate) => ({
          id: candidate.id,
          label: candidate.buttonText,
          order: candidate.order,
        }))}
        furthestOrder={locked ? Number.MAX_SAFE_INTEGER : Math.max(quote.furthestPageOrder, pages[0].order)}
        packet={packet}
        userType={userType}
        locked={locked}
        maxRisks={quote.manual.maxRisks}
        rating={{
          valid: quote.ratingValid,
          error: packet.RatingError ?? "",
          total: quote.totalPremium === null ? null : Number(quote.totalPremium),
          rows: quote.ratingResults.map((row) => ({
            risk: row.risk,
            description: row.description ?? row.fieldName,
            coverageCode: row.coverageCode ?? "",
            amount: Number(row.premiumAmount),
          })),
        }}
        payment={{
          paid: packet.PaymentStatus === "PAID",
          amount: packet.PaymentStatus === "PAID" ? Number(packet.PaymentAmount) : quote.totalPremium === null ? null : Number(quote.totalPremium),
          ratingValid: quote.ratingValid,
          reference: packet.PaymentReference ?? "",
          method: packet.PaymentMethod ?? "",
          paidOn: packet.PaymentDate ?? "",
        }}
        esign={{
          status: quote.policy ? "COMPLETE" : quote.esignAuthorizations.length > 0 ? "PENDING" : "NONE",
          signerName: quote.esignAuthorizations[0]?.contactName ?? quote.applicantName ?? "",
          signerEmail: quote.esignAuthorizations[0]?.contactEmail ?? quote.applicantEmail ?? "",
          link: quote.esignAuthorizations[0] ? signingLink(quote.esignAuthorizations[0].id) : "",
          documents: quote.esignDocuments.map((document) => ({ id: document.id, title: document.title, signed: document.statusCode === "C" })),
          policyId: quote.policy?.id ?? null,
          policyNumber: quote.policy?.policyNumber ?? "",
        }}
        hasPrevious={index > 0}
        hasNext={index < pages.length - 1}
        nextText={page.props.NextButtonText || view.props.NextButtonText || "Save and next"}
        previousText={view.props.PreviousButtonText || "Previous"}
      />
    </>
  );
}
