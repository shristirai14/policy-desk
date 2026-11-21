"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendCodeAction, signAction, verifyCodeAction } from "../actions";

export function AuthorizeForm({ token, name, maskedEmail }: { token: string; name: string; maskedEmail: string }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [signature, setSignature] = useState(name);
  const [initials, setInitials] = useState(
    name
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 4)
      .toUpperCase(),
  );
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  function sendCode() {
    setError("");
    setNotice("");
    startTransition(async () => {
      const result = await sendCodeAction(token);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSent(true);
      setNotice(`A 6-digit code was sent to ${maskedEmail}. It expires in 10 minutes.`);
    });
  }

  function verify(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!consent) {
      setError("Tick the box to agree to sign electronically.");
      return;
    }
    startTransition(async () => {
      const result = await verifyCodeAction({ token, code, signatureText: signature, initialsText: initials, consent: true });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {!sent ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            To confirm it is you, we will email a one-time code to <span className="font-medium">{maskedEmail}</span>.
          </p>
          <Button type="button" className="self-start" size="lg" disabled={pending} onClick={sendCode}>
            {pending ? "Sending..." : "Email me a code"}
          </Button>
        </div>
      ) : (
        <form onSubmit={verify} className="flex max-w-md flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sign-code">Code from the email</Label>
            <Input
              id="sign-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sign-name">Your full name, used as your signature</Label>
            <Input id="sign-name" required value={signature} onChange={(e) => setSignature(e.target.value)} />
            {signature ? (
              <p aria-hidden="true" className="rounded-lg border bg-background px-3 py-2 font-serif text-2xl italic text-blue-900">
                {signature}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sign-initials">Your initials</Label>
            <Input id="sign-initials" className="w-24" maxLength={6} required value={initials} onChange={(e) => setInitials(e.target.value.toUpperCase())} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I agree to sign these documents electronically and to adopt the name and initials above as my signature.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
              {pending ? "Checking..." : "Confirm and continue"}
            </Button>
            <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={sendCode}>
              Send a new code
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function SignForm({ token, documentId, signature }: { token: string; documentId: number; signature: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function sign(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!agreed) {
      setError("Tick the box to confirm you have read the document.");
      return;
    }
    startTransition(async () => {
      const result = await signAction({ token, documentId, agreed: true });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/esign/${token}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={sign} className="flex flex-col gap-3">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I have read this document and I am signing it as {signature}.</span>
      </label>
      <Button type="submit" size="lg" className="self-start" disabled={pending}>
        {pending ? "Signing..." : "Sign this document"}
      </Button>
    </form>
  );
}
