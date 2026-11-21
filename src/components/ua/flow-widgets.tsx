"use client";

import { FormSelect } from "@/components/form-select";
import { CircleCheck, Clock, Copy, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney } from "@/lib/status";
import { cn } from "@/lib/utils";

export type PaymentView = {
  paid: boolean;
  amount: number | null;
  ratingValid: boolean;
  reference: string;
  method: string;
  paidOn: string;
};

export type EsignView = {
  status: "NONE" | "PENDING" | "COMPLETE";
  signerName: string;
  signerEmail: string;
  link: string;
  documents: Array<{ id: number; title: string; signed: boolean }>;
  policyId: number | null;
  policyNumber: string;
};

const METHODS = [
  { code: "UPI", label: "UPI" },
  { code: "CARD", label: "Card" },
  { code: "NETBANKING", label: "Net banking" },
];


export function PaymentPanel({
  payment,
  method,
  error,
  disabled,
  onMethod,
  onPay,
}: {
  payment: PaymentView | undefined;
  method: string;
  error?: string;
  disabled: boolean;
  onMethod: (code: string) => void;
  onPay: (simulateFailure: boolean) => void;
}) {
  const [upi, setUpi] = useState("");
  const [card, setCard] = useState("");
  const [bank, setBank] = useState("");

  if (!payment) return null;

  if (payment.paid) {
    return (
      <div className="col-span-12 flex flex-col gap-3 rounded-lg border p-4">
        <p className="flex items-center gap-2 font-medium">
          <CircleCheck className="size-4" />
          Payment received
        </p>
        <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
          <dt className="text-muted-foreground">Amount</dt>
          <dd className="tabular-nums">{formatMoney(payment.amount)}</dd>
          <dt className="text-muted-foreground">Method</dt>
          <dd>{METHODS.find((item) => item.code === payment.method)?.label ?? payment.method}</dd>
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="font-mono">{payment.reference}</dd>
          <dt className="text-muted-foreground">Paid on</dt>
          <dd>{formatDate(payment.paidOn)}</dd>
        </dl>
      </div>
    );
  }

  if (!payment.ratingValid || payment.amount === null) {
    return (
      <div className="col-span-12 rounded-lg border border-dashed p-4 text-sm">
        <p className="font-medium">Nothing to pay yet</p>
        <p className="text-muted-foreground">Go back to the quote page so the premium can be calculated, then return here.</p>
      </div>
    );
  }

  const simulateFailure =
    (method === "UPI" && upi.trim().toLowerCase() === "fail@upi") || (method === "CARD" && card.replace(/\s/g, "").endsWith("0002"));
  const ready = (method === "UPI" && upi.includes("@")) || (method === "CARD" && card.replace(/\s/g, "").length >= 12) || (method === "NETBANKING" && bank !== "");

  return (
    <div className="col-span-12 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/50 p-4">
        <span className="text-sm text-muted-foreground">Amount to pay</span>
        <span className="text-2xl font-semibold tabular-nums">{formatMoney(payment.amount)}</span>
      </div>
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        This is a demonstration payment. No money is taken and nothing typed here is stored, so do not enter real details. To see a
        declined payment, use the UPI ID fail@upi or a card number ending 0002.
      </p>
      <div role="radiogroup" aria-label="Payment method" className="flex flex-wrap gap-2">
        {METHODS.map((item) => (
          <label
            key={item.code}
            className={cn(
              "flex h-9 cursor-pointer items-center rounded-lg border px-4 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              method === item.code ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name="PaymentMethod"
              className="sr-only"
              value={item.code}
              checked={method === item.code}
              disabled={disabled}
              onChange={() => onMethod(item.code)}
            />
            {item.label}
          </label>
        ))}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {method === "UPI" ? (
        <div className="flex max-w-sm flex-col gap-1.5">
          <label htmlFor="pay-upi" className="text-sm font-medium">
            UPI ID
          </label>
          <Input id="pay-upi" className="h-9" autoComplete="off" placeholder="name@bank" value={upi} onChange={(e) => setUpi(e.target.value)} />
        </div>
      ) : null}
      {method === "CARD" ? (
        <div className="grid max-w-md gap-3 sm:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pay-card" className="text-sm font-medium">
              Card number
            </label>
            <Input
              id="pay-card"
              className="h-9"
              inputMode="numeric"
              autoComplete="off"
              placeholder="4111 1111 1111 1111"
              value={card}
              onChange={(e) => setCard(e.target.value.replace(/[^\d ]/g, "").slice(0, 19))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pay-expiry" className="text-sm font-medium">
              Expiry
            </label>
            <Input id="pay-expiry" className="h-9" autoComplete="off" placeholder="MM/YY" maxLength={5} />
          </div>
        </div>
      ) : null}
      {method === "NETBANKING" ? (
        <div className="flex max-w-sm flex-col gap-1.5">
          <label htmlFor="pay-bank" className="text-sm font-medium">
            Bank
          </label>
          <FormSelect
            id="pay-bank"
            size="lg"
            placeholder="Select"
            value={bank}
            onValueChange={setBank}
            options={["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank"].map((item) => ({ value: item, label: item }))}
          />
        </div>
      ) : null}
      <Button type="button" className="self-start" disabled={disabled || !ready} onClick={() => onPay(simulateFailure)}>
        Pay {formatMoney(payment.amount)}
      </Button>
    </div>
  );
}

export function EsignPanel({
  esign,
  disabled,
  onAction,
}: {
  esign: EsignView | undefined;
  disabled: boolean;
  onAction: (action: "ESIGN" | "RESETESIGN" | "RESENDESIGN", confirmText?: string) => void;
}) {
  if (!esign) return null;

  if (esign.status === "NONE") {
    return (
      <div className="col-span-12 flex flex-col gap-3">
        <p className="text-sm">
          The documents for this quote are prepared from its answers and emailed to{" "}
          <span className="font-medium">{esign.signerEmail || "the proposer"}</span> with a link to sign them online. The policy is issued as soon
          as every document is signed.
        </p>
        <Button type="button" className="self-start" disabled={disabled} onClick={() => onAction("ESIGN")}>
          Send documents for e-sign
        </Button>
      </div>
    );
  }

  const complete = esign.status === "COMPLETE";
  return (
    <div className="col-span-12 flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {complete ? <CircleCheck className="size-4" /> : <Clock className="size-4" />}
        {complete ? (
          <span>
            Signed by {esign.signerName}. Policy <span className="font-medium">{esign.policyNumber}</span> is issued.
          </span>
        ) : (
          <span>
            Waiting for {esign.signerName} ({esign.signerEmail}) to sign.
          </span>
        )}
      </p>
      <ul className="flex flex-col gap-2">
        {esign.documents.map((document) => (
          <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <span className="flex items-center gap-2 text-sm">
              <FileText className="size-4 text-muted-foreground" />
              {document.title}
            </span>
            <span className="flex items-center gap-3">
              <Badge variant={document.signed ? "success" : "outline"}>{document.signed ? "Signed" : "Not signed yet"}</Badge>
              <Link href={`/api/documents/${document.id}`} target="_blank" className="text-sm underline-offset-4 hover:underline">
                View
              </Link>
            </span>
          </li>
        ))}
      </ul>
      {complete ? (
        esign.policyId ? (
          <Button nativeButton={false} variant="outline" className="self-start" render={<Link href={`/policies/${esign.policyId}`} />}>
            Open policy {esign.policyNumber}
          </Button>
        ) : null
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="esign-link" className="text-sm font-medium">
              Signing link
            </label>
            <div className="flex gap-2">
              <Input id="esign-link" readOnly value={esign.link} className="h-9 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(esign.link).then(
                    () => toast.success("Signing link copied."),
                    () => toast.error("Could not copy. Select the link and copy it."),
                  );
                }}
              >
                <Copy />
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">The same link was emailed to the signer. Anyone with it can view these documents after confirming a code sent to that email.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={disabled} onClick={() => onAction("RESENDESIGN")}>
              Resend email
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={disabled}
              onClick={() => onAction("RESETESIGN", "Cancel this e-sign? The signing link stops working and any signatures already given are discarded.")}
            >
              Cancel e-sign
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
