"use client";

import { useActionState, useState } from "react";
import { updateUserAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserEditFormProps {
  userId: string;
  currentName: string | null | undefined;
  currentEmail: string;
  currentRole: string;
}

export function UserEditForm({
  userId,
  currentName,
  currentEmail,
  currentRole,
}: UserEditFormProps) {
  const boundAction = updateUserAction.bind(null, userId);
  const [state, action, pending] = useActionState(boundAction, {});
  const [role, setRole] = useState(currentRole);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          Saved successfully.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={currentName ?? ""}
            placeholder="Full name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={currentEmail}
            placeholder="email@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Platform role</Label>
          <input type="hidden" name="platformRole" value={role} />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">member</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Leave blank to keep current"
            autoComplete="new-password"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
