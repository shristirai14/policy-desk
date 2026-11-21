"use client";

import { MoreHorizontal } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resendInviteAction, setUserActiveAction, type ActionResult } from "./actions";

export function UserRowActions({ userId, active, isSelf }: { userId: string; active: boolean; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" disabled={pending} />}>
        <MoreHorizontal />
        <span className="sr-only">User actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onClick={() => run(() => resendInviteAction(userId))}>Send set-password email</DropdownMenuItem>
        {isSelf ? null : (
          <DropdownMenuItem
            variant={active ? "destructive" : "default"}
            onClick={() => run(() => setUserActiveAction(userId, !active))}
          >
            {active ? "Deactivate" : "Reactivate"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
