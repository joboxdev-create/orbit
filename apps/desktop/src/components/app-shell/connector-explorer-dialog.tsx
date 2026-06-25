import { ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConnectorStore } from "./connector-store";

export function ConnectorExplorerDialog({
  availableTypes,
}: {
  availableTypes: string[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Explore the full catalogue
          <ArrowUpRight size={12} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Connector catalogue</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-sm text-muted-foreground">
          Explore the connectors Orbit can integrate. Available ones can be added
          to a project; the rest are on the roadmap.
        </p>
        <ConnectorStore availableTypes={availableTypes} />
      </DialogContent>
    </Dialog>
  );
}
