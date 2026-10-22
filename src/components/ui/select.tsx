import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/** Select nativo estilizado: acessível por padrão e funciona sem JavaScript. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-input bg-surface-sunken pr-9 pl-3 text-sm text-foreground outline-none",
          "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25",
          "aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
