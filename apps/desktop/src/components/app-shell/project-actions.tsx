import { type FormEvent, useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { api, type Project } from "@/lib/api";
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

export function ProjectActions({
  project,
  onChanged,
  onDeleted,
}: {
  project: Project;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreVertical size={16} />
            <span className="sr-only">Project actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-36">
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

      {editOpen && (
        <EditProjectDialog
          project={project}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={onChanged}
        />
      )}
      {deleteOpen && (
        <DeleteProjectDialog
          project={project}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}

function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSaved,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);
  const [description, setDescription] = useState(project.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateProject(project.id, { name, slug, description });
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
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Name</Label>
            <Input
              id="ep-name"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-slug">Slug (folder name)</Label>
            <Input
              id="ep-slug"
              value={slug}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Renaming the slug renames the project folder on disk.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-desc">Description</Label>
            <Input
              id="ep-desc"
              value={description}
              placeholder="Short description"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
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

function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: {
  project: Project;
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
      await api.deleteProject(project.id);
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
          <DialogTitle>Delete project</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Delete{" "}
          <span className="font-medium text-foreground">{project.name}</span> and
          its <span className="font-mono text-xs">.orbit/</span> folder? This
          removes it from disk and cannot be undone.
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
