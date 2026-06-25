import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { LAYER_LABELS, LayerKind } from "@orbit/shared";
import { api, type CatalogEntry } from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandIcon } from "@/components/ui/brand-icon";
import { cn } from "@/lib/utils";
import { ConnectorExplorerDialog } from "./connector-explorer-dialog";

function layerLabel(layer: string): string {
  return LAYER_LABELS[layer as keyof typeof LAYER_LABELS] ?? layer;
}

export function CreateConnectorDialog({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"catalog" | "custom">("catalog");
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [connectorType, setConnectorType] = useState("");
  const [name, setName] = useState("");
  const [layer, setLayer] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void api.catalog().then((cat) => {
      setCatalog(cat);
      if (cat[0]) {
        setConnectorType(cat[0].type);
        setName(cat[0].displayName);
      }
    });
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (tab === "catalog") {
        await api.registerConnector(projectId, {
          source: "catalog",
          connectorType,
          name,
        });
      } else {
        if (!layer) throw new Error("Select a layer");
        await api.registerConnector(projectId, {
          source: "custom",
          name,
          layer,
          config: url ? { url } : {},
        });
      }
      setOpen(false);
      setUrl("");
      setLayer("");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus size={14} />
          <span className="sr-only">Add connector</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add connector</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <TabButton active={tab === "catalog"} onClick={() => setTab("catalog")}>
            From catalog
          </TabButton>
          <TabButton active={tab === "custom"} onClick={() => setTab("custom")}>
            Custom (local)
          </TabButton>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {tab === "catalog" ? (
            <div className="space-y-1.5">
              <Label>Connector</Label>
              <Select
                value={connectorType}
                onValueChange={(v) => {
                  setConnectorType(v);
                  const c = catalog.find((x) => x.type === v);
                  if (c) setName(c.displayName);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a connector…" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.map((c) => (
                    <SelectItem key={c.type} value={c.type}>
                      <span className="flex items-center gap-2">
                        <BrandIcon slug={c.icon} size={15} />
                        {c.displayName} · {layerLabel(c.layer)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Layer</Label>
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
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cc-name">Name</Label>
            <Input
              id="cc-name"
              value={name}
              required
              placeholder={tab === "custom" ? "e.g. Production Postgres" : ""}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {tab === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="cc-url">URL (optional)</Label>
              <Input
                id="cc-url"
                value={url}
                type="url"
                placeholder="https://…"
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Registers the connector in this project.
            </p>
            {tab === "catalog" && (
              <ConnectorExplorerDialog
                availableTypes={catalog.map((c) => c.type)}
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name}>
              {saving ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
