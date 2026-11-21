"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { copyManualAction, deleteManualAction } from "./actions";

export function ManualRowActions({ manualId, name }: { manualId: number; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function copy() {
    startTransition(async () => {
      const result = await copyManualAction(manualId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (result.manualId) router.push(`/builder/${result.manualId}`);
    });
  }

  function remove() {
    if (!window.confirm(`Delete the manual "${name}" and everything in it? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteManualAction(manualId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" disabled={pending} />}>
        <MoreHorizontal />
        <span className="sr-only">Manual actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={() => router.push(`/builder/${manualId}`)}>Open</DropdownMenuItem>
        <DropdownMenuItem onClick={copy}>Copy manual</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={remove}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
