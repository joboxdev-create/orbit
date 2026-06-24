"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { LAYER_LABELS, LayerKind } from "@orbit/shared";
import { registerConnectorAction } from "@/app/(app)/orgs/[orgId]/projects/[projectId]/actions";
import type { ConnectorSummary } from "@/shared/api";
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
import { BrandIcon } from "@/common/brand-icon";
import { cn } from "@/lib/utils";

type Tab = "catalog" | "custom";

export function CreateConnectorDialog({
  orgId,
  projectId,
  catalog,
}: {
  orgId: string;
  projectId: string;
  catalog: ConnectorSummary[];
}) {
  const [open, setOpen] = useState(false);
  // Bump on each open so the inner form (and its useActionState) remounts fresh,
  // guaranteeing the success→close effect fires on every submit.
  const [formKey, setFormKey] = useState(0);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setFormKey((k) => k + 1);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-foreground"
        >
          <Plus size={14} />
          <span className="sr-only">Add connector</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add connector</DialogTitle>
        </DialogHeader>
        <ConnectorForm
          key={formKey}
          orgId={orgId}
          projectId={projectId}
          catalog={catalog}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ConnectorForm({
  orgId,
  projectId,
  catalog,
  onDone,
}: {
  orgId: string;
  projectId: string;
  catalog: ConnectorSummary[];
  onDone: () => void;
}) {
  const [tab, setTab] = useState<Tab>("catalog");
  const boundAction = registerConnectorAction.bind(null, orgId, projectId);
  const [state, action, pending] = useActionState(boundAction, {});
  const router = useRouter();
  const exploreHref = `/orgs/${orgId}/projects/${projectId}/connectors`;

  useEffect(() => {
    if (state.success) {
      onDone();
      router.refresh();
    }
  }, [state.success, onDone, router]);

  return (
    <>
      {/* Tab toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <TabButton active={tab === "catalog"} onClick={() => setTab("catalog")}>
          From catalog
        </TabButton>
        <TabButton active={tab === "custom"} onClick={() => setTab("custom")}>
          Custom (local)
        </TabButton>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="source" value={tab} />

        {state.error && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        {tab === "catalog" ? (
          <CatalogFields catalog={catalog} exploreHref={exploreHref} />
        ) : (
          <CustomFields />
        )}

        <p className="text-xs text-muted-foreground">
          This registers the connector in the project. Credentials and the live
          connection are configured in a later step.
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </div>
      </form>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
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

function CatalogFields({
  catalog,
  exploreHref,
}: {
  catalog: ConnectorSummary[];
  exploreHref: string;
}) {
  const [type, setType] = useState(catalog[0]?.type ?? "");
  const [name, setName] = useState(catalog[0]?.displayName ?? "");

  if (catalog.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          No catalog connectors are available yet.
        </p>
        <ExploreLink href={exploreHref} />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label>Connector</Label>
        <input type="hidden" name="connectorType" value={type} />
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v);
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
                  {c.displayName}
                  <span className="text-muted-foreground">
                    · {LAYER_LABELS[c.layer as keyof typeof LAYER_LABELS] ?? c.layer}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="catalog-name">Name</Label>
        <Input
          id="catalog-name"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <ExploreLink href={exploreHref} />
    </>
  );
}

function CustomFields() {
  const [layer, setLayer] = useState("");
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="custom-name">Name</Label>
        <Input
          id="custom-name"
          name="name"
          required
          placeholder="e.g. Production Postgres"
        />
      </div>
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
        <Label htmlFor="url">URL (optional)</Label>
        <Input id="url" name="url" type="url" placeholder="https://…" />
      </div>
    </>
  );
}

function ExploreLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      Explore the full catalogue
      <ArrowUpRight size={12} />
    </Link>
  );
}
