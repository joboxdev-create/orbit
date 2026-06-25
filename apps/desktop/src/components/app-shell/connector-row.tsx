import { type FormEvent, useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { LAYER_LABELS, LayerKind } from "@orbit/shared";
import { api, type CatalogEntry, type ConnectorInstance } from "@/lib/api";
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
import { BrandIcon } from "@/components/ui/brand-icon";
import { cn } from "@/lib/utils";

const CUSTOM = "custom";

export function ConnectorRow({
  connector,
  catalog,
  active,
  onSelect,
  onChanged,
}: {
  connector: ConnectorInstance;
  catalog: CatalogEntry[];
  active: boolean;
  onSelect: () => void;
  onChanged: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const iconSlug =
    catalog.find((c) => c.type === connector.connectorType)?.icon ?? null;

  return (
    <div className="group/row relative flex items-center">
      <button
        onClick={onSelect}
        className={cn(
          "flex flex-1 items-center gap-2.5 rounded-md px-2.5 py-1.5 pr-7 text-left text-sm transition-colors",
          active
            ? "bg-accent font-medium text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <BrandIcon slug={iconSlug} size={14} />
        <span className="truncate">{connector.name}</span>
      </button>

      <div
        className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 transition-opacity",
          menuOpen ? "opacity-100" : "opacity-0 group-hover/row:opacity-100",
        )}
      >
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
              <MoreVertical size={14} />
              <span className="sr-only">Connector actions</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-32">
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
          connector={connector}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={onChanged}
        />
      )}
      {deleteOpen && (
        <DeleteConnectorDialog
          connector={connector}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={onChanged}
        />
      )}
    </div>
  );
}

function EditConnectorDialog({
  connector,
  open,
  onOpenChange,
  onSaved,
}: {
  connector: ConnectorInstance;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const isCustom = connector.connectorType === CUSTOM;
  const [name, setName] = useState(connector.name);
  const [layer, setLayer] = useState(connector.layer);
  const [url, setUrl] = useState(
    typeof connector.config?.url === "string" ? connector.config.url : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateConnector(connector.id, {
        name,
        ...(isCustom && { layer, config: url ? { url } : {} }),
      });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit connector</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ec-name">Name</Label>
            <Input
              id="ec-name"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {isCustom && (
            <>
              <div className="space-y-1.5">
                <Label>Layer</Label>
                <Select value={layer} onValueChange={setLayer}>
                  <SelectTrigger>
                    <SelectValue />
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
                <Label htmlFor="ec-url">URL (optional)</Label>
                <Input
                  id="ec-url"
                  value={url}
                  type="url"
                  placeholder="https://…"
                  onChange={(e) => setUrl(e.target.value)}
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
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConnectorDialog({
  connector,
  open,
  onOpenChange,
  onDeleted,
}: {
  connector: ConnectorInstance;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDeleted: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setPending(true);
    setError(null);
    try {
      await api.deleteConnector(connector.id);
      onOpenChange(false);
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete connector</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Delete{" "}
          <span className="font-medium text-foreground">{connector.name}</span>?
          This cannot be undone.
        </p>
        {error && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
