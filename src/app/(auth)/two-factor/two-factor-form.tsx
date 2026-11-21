"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthLink, AuthSubmit, AuthTextButton } from "@/components/auth/auth-controls";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Method = "email" | "totp" | "backup";

const DESCRIPTIONS: Record<Method, string> = {
  email: "We emailed a 6-digit code to your account address.",
  totp: "Enter the 6-digit code from your authenticator app.",
  backup: "Enter one of the backup codes you saved when you set up your authenticator.",
};

export function TwoFactorForm({ next, hasTotp }: { next: string; hasTotp: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>(hasTotp ? "totp" : "email");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const sentRef = useRef(false);

  async function sendEmailCode() {
    setError("");
    const { error: sendError } = await authClient.twoFactor.sendOtp();
    if (sendError) {
      setError(
        sendError.status === 429
          ? "Too many requests. Wait a minute and try again."
          : "Your sign-in has expired. Go back and sign in again.",
      );
      return;
    }
    setNotice("A new code has been sent.");
  }

  useEffect(() => {
    if (method !== "email" || sentRef.current) return;
    sentRef.current = true;
    authClient.twoFactor.sendOtp().then(({ error: sendError }) => {
      if (sendError) setError("Your sign-in has expired. Go back and sign in again.");
    });
  }, [method]);

  function switchTo(target: Method) {
    setMethod(target);
    setCode("");
    setError("");
    setNotice("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPending(true);
    const result =
      method === "email"
        ? await authClient.twoFactor.verifyOtp({ code })
        : method === "totp"
          ? await authClient.twoFactor.verifyTotp({ code })
          : await authClient.twoFactor.verifyBackupCode({ code });
    if (result.error) {
      setPending(false);
      setCode("");
      setError(
        result.error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "That code is not correct or has expired.",
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  const ready = method === "backup" ? code.trim().length >= 6 : code.length === 6;

  return (
    <div className="stagger flex flex-col gap-8">
      <AuthHeading title="Verify it is you" description={DESCRIPTIONS[method]} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
        {method === "backup" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="backup">Backup code</Label>
            <Input
              id="backup"
              autoComplete="off"
              className="h-9 font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="otp">Verification code</Label>
            <InputOTP id="otp" maxLength={6} value={code} onChange={setCode} autoFocus inputMode="numeric">
              <InputOTPGroup>
                {[0, 1, 2].map((index) => (
                  <InputOTPSlot key={index} index={index} className="h-11 w-10 bg-card font-mono text-lg" />
                ))}
              </InputOTPGroup>
              <InputOTPSeparator className="px-1 text-muted-foreground" />
              <InputOTPGroup>
                {[3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index} className="h-11 w-10 bg-card font-mono text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        )}
        <AuthSubmit pending={pending} pendingLabel="Verifying" disabled={!ready}>
          Verify
        </AuthSubmit>
      </form>
      <div className="flex flex-col items-center gap-2">
        {method === "email" ? (
          <AuthTextButton onClick={sendEmailCode}>Send a new code</AuthTextButton>
        ) : (
          <AuthTextButton onClick={() => switchTo("email")}>Email me a code instead</AuthTextButton>
        )}
        {hasTotp && method !== "totp" ? (
          <AuthTextButton onClick={() => switchTo("totp")}>Use my authenticator app</AuthTextButton>
        ) : null}
        {hasTotp && method !== "backup" ? (
          <AuthTextButton onClick={() => switchTo("backup")}>Use a backup code</AuthTextButton>
        ) : null}
        <AuthLink href="/login">Back to sign in</AuthLink>
      </div>
    </div>
  );
}
