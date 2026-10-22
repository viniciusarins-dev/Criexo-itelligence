import * as React from "react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  label,
  description,
  id,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { label: React.ReactNode; description?: React.ReactNode }) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 text-sm", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-input accent-primary disabled:cursor-not-allowed"
        {...props}
      />
      <span className="space-y-0.5">
        <span className="block text-foreground">{label}</span>
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}

export { Checkbox };
