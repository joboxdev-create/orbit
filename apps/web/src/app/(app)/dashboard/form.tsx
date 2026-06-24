"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createOrgAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateOrgForm() {
  const [state, action, pending] = useActionState(createOrgAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <Label htmlFor="org-name">Name</Label>
          <Input
            id="org-name"
            name="name"
            required
            placeholder="Acme Inc"
          />
        </div>
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <Label htmlFor="org-slug">Slug</Label>
          <Input
            id="org-slug"
            name="slug"
            required
            placeholder="acme"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        <Plus size={16} />
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
