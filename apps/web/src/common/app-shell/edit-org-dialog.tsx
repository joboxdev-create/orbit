"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateOrgAction } from "@/app/(app)/orgs/[orgId]/actions";
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

interface EditOrgDialogProps {
  orgId: string;
  currentName: string;
  currentSlug: string;
}

export function EditOrgDialog({
  orgId,
  currentName,
  currentSlug,
}: EditOrgDialogProps) {
  const [open, setOpen] = useState(false);
  const boundAction = updateOrgAction.bind(null, orgId);
  const [state, action, pending] = useActionState(boundAction, {});
  const slugRef = useRef<HTMLInputElement>(null);
  const slugEdited = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state.success, router]);

  useEffect(() => {
    if (!open) slugEdited.current = false;
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit organization</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state.error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="edit-org-name">Name</Label>
            <Input
              id="edit-org-name"
              name="name"
              defaultValue={currentName}
              required
              onChange={(e) => {
                if (!slugEdited.current && slugRef.current) {
                  slugRef.current.value = toSlug(e.target.value);
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-org-slug">Slug</Label>
            <Input
              id="edit-org-slug"
              name="slug"
              defaultValue={currentSlug}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              ref={slugRef}
              onChange={() => {
                slugEdited.current = true;
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
