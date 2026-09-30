import type { ReactNode } from "react";

export function PageHeading({ title, lead }: { title: ReactNode; lead: ReactNode }) {
  return (
    <div>
      <h2 className="zr-h2">{title}</h2>
      <p className="zr-lead">{lead}</p>
    </div>
  );
}
