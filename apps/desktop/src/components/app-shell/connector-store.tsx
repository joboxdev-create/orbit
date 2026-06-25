import { type ReactNode, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { LAYER_LABELS, LayerKind, type LayerKind as LK } from "@orbit/shared";
import { CONNECTOR_CATALOG } from "@/lib/connector-catalog";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ConnectorStore({
  availableTypes,
}: {
  availableTypes: string[];
}) {
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState<LK | "all">("all");
  const available = useMemo(() => new Set(availableTypes), [availableTypes]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CONNECTOR_CATALOG.filter(
      (e) =>
        (layer === "all" || e.layer === layer) &&
        (!q || e.name.toLowerCase().includes(q)),
    );
  }, [query, layer]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search connectors…"
          className="h-9 pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={layer === "all"} onClick={() => setLayer("all")}>
          All
        </FilterChip>
        {LayerKind.options.map((k) => (
          <FilterChip key={k} active={layer === k} onClick={() => setLayer(k)}>
            {LAYER_LABELS[k]}
          </FilterChip>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No connectors match “{query}”.
        </p>
      ) : (
        <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
          {results.map((entry) => {
            const isAvailable =
              !!entry.connectorType && available.has(entry.connectorType);
            return (
              <div
                key={entry.slug + entry.layer}
                className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-border/70 hover:bg-accent/5"
              >
                <div className="flex size-11 items-center justify-center transition-transform group-hover:scale-110">
                  <BrandIcon slug={entry.slug} size={36} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{entry.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {LAYER_LABELS[entry.layer]}
                  </p>
                </div>
                {isAvailable ? (
                  <Badge className="gap-1">
                    <span className="size-1.5 rounded-full bg-green-400" />
                    Available
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal">
                    Coming soon
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
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
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
