"use client";

import { FormSelect } from "@/components/form-select";
import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { createUserAction } from "./actions";

const ROLE_OPTIONS: Role[] = ["agent", "underwriter", "admin"];

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [agentCode, setAgentCode] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setEmail("");
    setRole("agent");
    setAgentCode("");
    setAgencyName("");
    setError("");
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await createUserAction({ name, email, role, agentCode, agencyName });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(result.message);
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        New user
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New user</DialogTitle>
            <DialogDescription>The user gets an email with a link to set their password.</DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-name">Full name</Label>
            <Input id="user-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-role">Role</Label>
            <FormSelect
              id="user-role"
              value={role}
              onValueChange={(next) => setRole(next as Role)}
              options={ROLE_OPTIONS.map((option) => ({ value: option, label: ROLE_LABELS[option] }))}
            />
          </div>
          {role === "agent" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="agent-code">Agent code</Label>
                <Input
                  id="agent-code"
                  required
                  placeholder="AG0002"
                  value={agentCode}
                  onChange={(e) => setAgentCode(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="agency-name">Agency name</Label>
                <Input
                  id="agency-name"
                  placeholder="Used for a new agent code"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
