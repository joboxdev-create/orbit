"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5">
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-left text-xs text-muted-foreground">
        <span className="select-none text-foreground/40">$ </span>
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        title="Copy"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? (
          <Check size={14} className="text-green-500" />
        ) : (
          <Copy size={14} />
        )}
        <span className="sr-only">Copy command</span>
      </button>
    </div>
  );
}
