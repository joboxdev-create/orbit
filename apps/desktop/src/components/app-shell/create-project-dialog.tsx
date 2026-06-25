import { type FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

function toSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateProjectDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createProject({ name, slug });
      setOpen(false);
      reset();
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus size={14} />
          <span className="sr-only">New project</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="np-name">Name</Label>
            <Input
              id="np-name"
              value={name}
              required
              placeholder="My Project"
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) setSlug(toSlug(e.target.value));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-slug">Slug (folder name)</Label>
            <Input
              id="np-slug"
              value={slug}
              required
              placeholder="my-project"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugEdited(true);
              }}
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
            <Button type="submit" disabled={saving || !name || !slug}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
