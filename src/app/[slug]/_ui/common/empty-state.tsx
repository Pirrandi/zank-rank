import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="zr-empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
