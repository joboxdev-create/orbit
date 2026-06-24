"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { LAYER_LABELS, LayerKind } from "@orbit/shared";
import {
  updateConnectorAction,
  deleteConnectorAction,
} from "@/app/(app)/orgs/[orgId]/projects/[projectId]/actions";
import { CUSTOM_CONNECTOR_TYPE, type ConnectorInstance } from "@/shared/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { NavLink } from "./nav-link";

interface ConnectorRowProps {
  orgId: string;
  projectId: string;
  instance: ConnectorInstance;
  href: string;
  glyph?: ReactNode;
}

export function ConnectorRow({
  orgId,
  projectId,
  instance,
  href,
  glyph,
}: ConnectorRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="group/row relative flex items-center">
      <NavLink href={href} icon={glyph} className="flex-1 pr-7">
        {instance.name}
      </NavLink>

      <div
        className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 transition-opacity",
          menuOpen ? "opacity-100" : "opacity-0 group-hover/row:opacity-100",
        )}
      >
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <MoreVertical size={14} />
              <span className="sr-only">Connector actions</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil size={14} />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 size={14} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {editOpen && (
        <EditConnectorDialog
          orgId={orgId}
          projectId={projectId}
          instance={instance}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {deleteOpen && (
        <DeleteConnectorDialog
          orgId={orgId}
          instance={instance}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </div>
  );
}

function EditConnectorDialog({
  orgId,
  instance,
  open,
  onOpenChange,
}: {
  orgId: string;
  projectId: string;
  instance: ConnectorInstance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isCustom = instance.connectorType === CUSTOM_CONNECTOR_TYPE;
  const boundAction = updateConnectorAction.bind(
    null,
    orgId,
    instance.id,
    isCustom,
  );
  const [state, action, pending] = useActionState(boundAction, {});
  const [layer, setLayer] = useState(instance.layer);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state.success, onOpenChange, router]);

  const currentUrl =
    typeof instance.config?.url === "string" ? instance.config.url : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit connector</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state.error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="edit-conn-name">Name</Label>
            <Input
              id="edit-conn-name"
              name="name"
              required
              defaultValue={instance.name}
            />
          </div>

          {isCustom && (
            <>
              <div className="space-y-1.5">
                <Label>Layer</Label>
                <input type="hidden" name="layer" value={layer} />
                <Select value={layer} onValueChange={setLayer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a layer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {LayerKind.options.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {LAYER_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-conn-url">URL (optional)</Label>
                <Input
                  id="edit-conn-url"
                  name="url"
                  type="url"
                  defaultValue={currentUrl}
                  placeholder="https://…"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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

function DeleteConnectorDialog({
  orgId,
  instance,
  open,
  onOpenChange,
}: {
  orgId: string;
  instance: ConnectorInstance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const boundAction = deleteConnectorAction.bind(null, orgId, instance.id);
  const [state, action, pending] = useActionState(boundAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state.success, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete connector</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{" "}
          <span className="font-medium text-foreground">{instance.name}</span>?
          This cannot be undone.
        </p>
        {state.error && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <form action={action} className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
