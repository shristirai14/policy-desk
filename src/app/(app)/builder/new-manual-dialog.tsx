"use client";

import { FormSelect } from "@/components/form-select";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createManualAction } from "./actions";


export function NewManualDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [policyTypeCode, setPolicyTypeCode] = useState<"PVTCAR" | "TWOWHEELER">("PVTCAR");
  const [viewName, setViewName] = useState("New Business");
  const [pages, setPages] = useState("Proposer, Vehicles, Coverages, Quote");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const pageNames = pages
      .split(",")
      .map((page) => page.trim())
      .filter(Boolean);
    startTransition(async () => {
      const result = await createManualAction({ name, policyTypeCode, viewName, pageNames });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      if (result.manualId) router.push(`/builder/${result.manualId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        New manual
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New manual</DialogTitle>
            <DialogDescription>
              Creates a draft manual with one view and a starter section on each page. Agents see it once its status is Active.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="manual-name">Manual name</Label>
            <Input id="manual-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Two Wheeler Package Policy" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="manual-product">Product</Label>
              <FormSelect
                id="manual-product"
                value={policyTypeCode}
                onValueChange={(next) => setPolicyTypeCode(next === "TWOWHEELER" ? "TWOWHEELER" : "PVTCAR")}
                options={[
                  { value: "PVTCAR", label: "Private car" },
                  { value: "TWOWHEELER", label: "Two-wheeler" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="manual-view">First view</Label>
              <Input id="manual-view" required value={viewName} onChange={(e) => setViewName(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manual-pages">Starter pages</Label>
            <Input id="manual-pages" required value={pages} onChange={(e) => setPages(e.target.value)} />
            <p className="text-xs text-muted-foreground">Page names separated by commas, in the order agents will see them.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create manual"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
