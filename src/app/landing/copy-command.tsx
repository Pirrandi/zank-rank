"use client";

import { useEffect, useState } from "react";

const RESET_MS = 1800;

export function CopyCommand({
  command,
  idleLabel,
  doneLabel,
}: {
  command: string;
  idleLabel: string;
  doneLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), RESET_MS);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles (o contexto no seguro): el comando sigue visible para copiar a mano.
    }
  }

  return (
    <div className="lp-clone">
      <span className="lp-clone-prompt" aria-hidden="true">
        $
      </span>
      <code className="lp-clone-cmd" title={command}>
        {command}
      </code>
      <button type="button" className={copied ? "lp-clone-btn is-copied" : "lp-clone-btn"} onClick={copy}>
        {copied ? doneLabel : idleLabel}
      </button>
    </div>
  );
}
