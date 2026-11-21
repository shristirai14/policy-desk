"use client";

import { useState } from "react";
import { AuthLink, AuthSubmit } from "@/components/auth/auth-controls";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const { error: requestError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (requestError?.status === 429) {
      setError("Too many requests. Wait a minute and try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="stagger flex flex-col gap-8">
      <AuthHeading
        title="Forgot password"
        description="Enter your account email and we will send a link to set a new password."
      />
      {sent ? (
        <Alert>
          <AlertDescription>
            If an account exists for {email}, a reset link is on its way. The link expires in 24 hours.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@agency.in"
              required
              className="h-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <AuthSubmit pending={pending} pendingLabel="Sending">
            Send reset link
          </AuthSubmit>
        </form>
      )}
      <AuthLink href="/login" className="self-center">
        Back to sign in
      </AuthLink>
    </div>
  );
}
