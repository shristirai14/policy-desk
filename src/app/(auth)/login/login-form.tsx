"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthLink, AuthSubmit } from "@/components/auth/auth-controls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const { data, error: signInError } = await authClient.signIn.email({ email, password });
    if (signInError) {
      setPending(false);
      setError(
        signInError.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "The email or password is not correct.",
      );
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      const methods = "twoFactorMethods" in data && Array.isArray(data.twoFactorMethods) ? data.twoFactorMethods : [];
      const query = new URLSearchParams({ next, methods: methods.join(",") });
      router.push(`/two-factor?${query}`);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="stagger flex flex-col gap-8">
      <AuthHeading title="Sign in" description="Use the email and password for your agent account." />
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <AuthLink href="/forgot-password">Forgot password?</AuthLink>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-9"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <AuthSubmit pending={pending} pendingLabel="Signing in">
          Sign in
        </AuthSubmit>
      </form>
    </div>
  );
}
