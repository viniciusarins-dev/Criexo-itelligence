import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-md border border-input bg-surface-sunken px-3 py-2 text-sm text-foreground outline-none placeholder:text-subtle-foreground",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25",
        "aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
