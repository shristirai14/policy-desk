import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuoteForm } from "@/components/ua/quote-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireRole } from "@/lib/session";
import { initialPacket } from "@/lib/ua/engine";
import { loadView } from "@/lib/ua/load";

export const metadata: Metadata = { title: "Page preview" };
export const instant = false;

export default async function PreviewPage({ params, searchParams }: PageProps<"/builder/[manualId]/preview/[pageId]">) {
  await requireRole("admin");
  const { manualId, pageId } = await params;
  const query = await searchParams;
  const view = await loadView(Number(query.view));
  if (!view || view.manualId !== Number(manualId)) notFound();
  const index = view.pages.findIndex((page) => page.id === Number(pageId));
  if (index === -1) notFound();
  const page = view.pages[index];
  const userType = query.as === "agent" ? "agent" : "internal";
  const packet = initialPacket(view, { QuoteNumber: "PREVIEW", UWQuoteCode: "A", UWStatusCode: "P", NumberOfRisks: "0" });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Preview: {page.name}</h1>
        <p className="text-sm text-muted-foreground">
          View &quot;{view.name}&quot;, shown as {userType === "agent" ? "an agent" : "company staff"} sees it.
        </p>
      </div>
      <Alert>
        <AlertDescription>
          This is a preview with a blank quote. Conditions and validation work as in a real quote, but nothing is saved and
          buttons do not move between pages.
        </AlertDescription>
      </Alert>
      <QuoteForm
        key={page.id}
        preview
        quoteId={0}
        page={page}
        steps={view.pages.filter((candidate) => candidate.milestone).map((candidate) => ({
          id: candidate.id,
          label: candidate.buttonText,
          order: candidate.order,
        }))}
        furthestOrder={-1}
        packet={packet}
        userType={userType}
        locked={false}
        hasPrevious={index > 0}
        hasNext={index < view.pages.length - 1}
        nextText={page.props.NextButtonText || view.props.NextButtonText || "Save and next"}
        previousText={view.props.PreviousButtonText || "Previous"}
      />
    </>
  );
}
