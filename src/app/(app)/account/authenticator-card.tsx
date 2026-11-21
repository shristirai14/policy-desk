"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { removeAuthenticatorAction } from "./actions";

type Setup = { qr: string; secret: string; backupCodes: string[] };

export function AuthenticatorCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [savedCodes, setSavedCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const { data, error: enableError } = await authClient.twoFactor.enable({ password });
    setPending(false);
    if (enableError || !data || !("totpURI" in data)) {
      setError("The password is not correct.");
      return;
    }
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
    setSetup({ qr: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 192 }), secret, backupCodes: data.backupCodes });
    setPassword("");
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!setup) return;
    setError("");
    setPending(true);
    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (verifyError) {
      setCode("");
      setError("That code is not correct. Check the time on your phone and try again.");
      return;
    }
    setSavedCodes(setup.backupCodes);
    setSetup(null);
    setCode("");
    toast.success("Authenticator app connected.");
    router.refresh();
  }

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const result = await removeAuthenticatorAction(password);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPassword("");
    setSavedCodes(null);
    toast.success(result.message);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-factor verification
          <Badge variant="secondary">{enabled ? "Authenticator app" : "Email code"}</Badge>
        </CardTitle>
        <CardDescription>
          Every sign-in needs a second step. By default a code is emailed to you; an authenticator app is faster and
          works without email.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {savedCodes ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              Save these backup codes somewhere safe. Each one works once if you lose your phone. They are not shown
              again.
            </p>
            <ul className="grid max-w-sm grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
              {savedCodes.map((backup) => (
                <li key={backup}>{backup}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {setup ? (
          <form onSubmit={confirm} className="flex flex-col gap-4">
            <p className="text-sm">Scan this code with Google Authenticator, Microsoft Authenticator or a similar app.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="QR code for your authenticator app" width={192} height={192} className="rounded-lg border" />
            <p className="text-xs text-muted-foreground">
              Cannot scan? Enter this key by hand: <span className="font-mono break-all">{setup.secret}</span>
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="totp-code">Code from the app</Label>
              <InputOTP id="totp-code" maxLength={6} value={code} onChange={setCode} inputMode="numeric">
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || code.length !== 6}>
                {pending ? "Checking..." : "Confirm"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSetup(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={enabled ? remove : start} className="flex max-w-sm flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="twofa-password">Confirm your password</Label>
              <Input
                id="twofa-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" variant={enabled ? "destructive" : "default"} className="self-start" disabled={pending}>
              {enabled ? "Remove authenticator app" : "Set up authenticator app"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
