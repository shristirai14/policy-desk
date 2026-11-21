import { ArrowLeft, CircleCheck, FileText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadSigning } from "@/lib/esign";
import { AuthorizeForm, SignForm } from "./signing-forms";

export const instant = false;

function maskEmail(email: string) {
  const [user, domain = ""] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default async function SigningPage({ params, searchParams }: PageProps<"/esign/[token]">) {
  const { token } = await params;
  const query = await searchParams;
  const signing = await loadSigning(token);

  if (!signing) return <Notice title="This link is not valid" text="Check that you opened the full link from the email, or ask your agent to send it again." />;
  const complete = signing.statusCode === "C";
  if (!complete && signing.quote.statusCode !== "B") {
    return <Notice title="This signing request was cancelled" text="Your agent has withdrawn these documents. They will send a new link if signing is still needed." />;
  }

  const heading = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Documents for quote {signing.quote.quoteNumber}</h1>
      <p className="text-sm text-muted-foreground">Prepared for {signing.contactName}.</p>
    </div>
  );

  if (signing.statusCode === "N") {
    return (
      <>
        {heading}
        <Card>
          <CardHeader>
            <CardTitle>Confirm it is you</CardTitle>
            <CardDescription>
              You have {signing.signatures.length} document(s) to read and sign. It takes a few minutes and needs no account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthorizeForm token={token} name={signing.contactName} maskedEmail={maskEmail(signing.contactEmail)} />
          </CardContent>
        </Card>
      </>
    );
  }

  const selectedId = typeof query.doc === "string" ? Number(query.doc) : 0;
  const selected = signing.signatures.find((signature) => signature.document.id === selectedId);

  if (selected) {
    const signed = selected.statusCode === "C";
    return (
      <>
        <div>
          <Link href={`/esign/${token}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline">
            <ArrowLeft className="size-3.5" />
            All documents
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{selected.document.title}</h1>
        </div>
        <iframe
          title={selected.document.title}
          src={`/esign/${token}/pdf/${selected.document.id}#view=FitH`}
          className="h-[70svh] w-full rounded-lg border bg-background"
        />
        <p className="text-sm">
          Cannot see the document?{" "}
          <a href={`/esign/${token}/pdf/${selected.document.id}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            Open it in a new tab
          </a>
          .
        </p>
        <Card>
          <CardContent>
            {signed ? (
              <p className="flex items-center gap-2 text-sm">
                <CircleCheck className="size-4" />
                You signed this document.
              </p>
            ) : (
              <SignForm token={token} documentId={selected.document.id} signature={signing.signatureText || signing.contactName} />
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  const remaining = signing.signatures.filter((signature) => signature.statusCode !== "C").length;
  const nextUp = signing.signatures.find((signature) => signature.statusCode !== "C");

  return (
    <>
      {heading}
      {complete ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleCheck className="size-5" />
              All documents are signed
            </CardTitle>
            <CardDescription>
              {signing.quote.policy
                ? `Policy ${signing.quote.policy.policyNumber} is issued. A copy of each signed document has been emailed to you.`
                : "Thank you. Your agent will confirm when the policy is issued."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <p className="text-sm">
          {remaining === 1 ? "1 document is" : `${remaining} documents are`} waiting for your signature. Open each one, read it, and sign.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {signing.signatures.map((signature) => {
          const signed = signature.statusCode === "C";
          return (
            <li key={signature.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4">
              <span className="flex items-center gap-2 font-medium">
                <FileText className="size-4 text-muted-foreground" />
                {signature.document.title}
              </span>
              <span className="flex items-center gap-3">
                <Badge variant={signed ? "success" : "outline"}>{signed ? "Signed" : "To sign"}</Badge>
                <Button nativeButton={false} variant={signed || signature.id !== nextUp?.id ? "outline" : "default"} render={<Link href={`/esign/${token}?doc=${signature.document.id}`} />}>
                  {signed ? "View" : "Read and sign"}
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
