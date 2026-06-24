"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createOrgAction } from "@/app/(app)/(platform)/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateOrgDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createOrgAction, {});
  const slugRef = useRef<HTMLInputElement>(null);
  const slugEdited = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state.success, router]);

  // Reset slug-edited flag when dialog closes.
  useEffect(() => {
    if (!open) slugEdited.current = false;
  }, [open]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugEdited.current && slugRef.current) {
      slugRef.current.value = toSlug(e.target.value);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
          <Plus size={14} />
          <span className="sr-only">New organization</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New organization</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state.error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              name="name"
              required
              placeholder="Acme Inc"
              onChange={handleNameChange}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              name="slug"
              required
              placeholder="acme"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              ref={slugRef}
              onChange={() => {
                slugEdited.current = true;
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
