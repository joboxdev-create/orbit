"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createProjectAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateProjectForm({ orgId }: { orgId: string }) {
  const action = createProjectAction.bind(null, orgId);
  const [state, boundAction, pending] = useActionState(action, {});

  return (
    <form action={boundAction} className="space-y-4">
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[160px] flex-1 space-y-1.5">
          <Label htmlFor="proj-name">Name</Label>
          <Input id="proj-name" name="name" required placeholder="Platform" />
        </div>
        <div className="min-w-[160px] flex-1 space-y-1.5">
          <Label htmlFor="proj-slug">Slug</Label>
          <Input
            id="proj-slug"
            name="slug"
            required
            placeholder="platform"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          />
        </div>
        <div className="w-full space-y-1.5">
          <Label htmlFor="proj-desc">Description (optional)</Label>
          <Input
            id="proj-desc"
            name="description"
            placeholder="What this project covers"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        <Plus size={16} />
        {pending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}
