"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateProjectAction } from "@/app/(app)/orgs/[orgId]/projects/[projectId]/actions";
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

interface EditProjectDialogProps {
  orgId: string;
  projectId: string;
  currentName: string;
  currentSlug: string;
  currentDescription?: string | null;
}

export function EditProjectDialog({
  orgId,
  projectId,
  currentName,
  currentSlug,
  currentDescription,
}: EditProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const boundAction = updateProjectAction.bind(null, orgId, projectId);
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
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state.error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="edit-proj-name">Name</Label>
            <Input
              id="edit-proj-name"
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
            <Label htmlFor="edit-proj-slug">Slug</Label>
            <Input
              id="edit-proj-slug"
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
          <div className="space-y-1.5">
            <Label htmlFor="edit-proj-desc">Description</Label>
            <Input
              id="edit-proj-desc"
              name="description"
              defaultValue={currentDescription ?? ""}
              placeholder="Short description"
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
