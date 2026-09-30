/** @fileoverview Displays trusted syntax markup produced during the demo build. */
import React from "react";

/** Preserves selectable code without loading a browser syntax parser. */
export function CodeExample({ label, html }: { label: string; html: string }) {
  return (
    <pre className="code-example" aria-label={label}>
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
