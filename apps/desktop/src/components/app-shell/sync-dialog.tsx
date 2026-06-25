import { useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
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

/**
 * Placeholder Sync flow. Everything in Orbit Desktop is local-first and works
 * fully offline; synchronization with an Orbit Server is the *only* part that
 * needs authentication (like `git push`). The real sync is a dedicated future
 * milestone — this dialog only sketches the entry point + the sign-in gate.
 */
export function SyncDialog() {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <Dialog onOpenChange={() => setShowSignIn(false)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <RefreshCw size={14} />
          Sync
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync with Orbit Server</DialogTitle>
        </DialogHeader>

        {!showSignIn ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <CloudOff size={18} className="mt-0.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Orbit Desktop is <span className="font-medium text-foreground">local-first</span>:
                everything works offline on your machine. Synchronization
                (clone / push / pull to an Orbit Server) is the only part that
                needs an account — like <span className="font-mono text-xs">git push</span>.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              You are not signed in. Sign in to sync this workspace with a
              server when the feature ships.
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowSignIn(true)}>Sign in</Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="space-y-1.5">
              <Label htmlFor="sync-server">Orbit Server URL</Label>
              <Input id="sync-server" placeholder="https://orbit.mycompany.com" disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sync-email">Email</Label>
              <Input id="sync-email" type="email" placeholder="you@company.com" disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sync-password">Password</Label>
              <Input id="sync-password" type="password" disabled />
            </div>
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Sign-in & sync are coming in a dedicated desktop ↔ server release.
              This screen is a preview.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSignIn(false)}
              >
                Back
              </Button>
              <Button type="submit" disabled>
                Sign in &amp; sync
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
