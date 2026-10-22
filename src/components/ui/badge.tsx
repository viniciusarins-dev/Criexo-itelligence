import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-border bg-neutral-subtle text-neutral-text",
        brand: "border-primary/30 bg-primary-subtle text-primary-text",
        success: "border-success/30 bg-success-subtle text-success-text",
        warning: "border-warning/30 bg-warning-subtle text-warning-text",
        danger: "border-danger/35 bg-danger-subtle text-danger-text",
        info: "border-info/30 bg-info-subtle text-info-text",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
