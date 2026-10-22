import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-input bg-surface-sunken px-3 py-2 text-sm text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-subtle-foreground",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25",
        "aria-invalid:border-danger aria-invalid:ring-danger/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
