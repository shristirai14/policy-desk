"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthSubmit } from "@/components/auth/auth-controls";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token, invalid }: { token: string; invalid: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setPending(true);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (resetError) {
      setError("This link is no longer valid. Request a new one.");
      return;
    }
    toast.success("Password saved. Sign in with your new password.");
    router.push("/login");
  }

  if (invalid) {
    return (
      <div className="stagger flex flex-col gap-8">
        <AuthHeading title="Link not valid" description="This password link has expired or was already used." />
        <Button nativeButton={false} size="lg" className="w-full" render={<Link href="/forgot-password" />}>
          Request a new link
        </Button>
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-8">
      <AuthHeading title="Set password" description="Choose a password of at least 8 characters." />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            className="h-9"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            className="h-9"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <AuthSubmit pending={pending} pendingLabel="Saving">
          Save password
        </AuthSubmit>
      </form>
    </div>
  );
}
