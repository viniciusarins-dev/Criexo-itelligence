import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function Stars({ value, max = 5, className }: { value: number; max?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value} de ${max} estrelas`}>
      {Array.from({ length: max }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={cn("size-3", index < value ? "fill-primary text-primary" : "text-border-strong")}
        />
      ))}
    </span>
  );
}
