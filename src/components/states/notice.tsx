import { AlertTriangle, Info, ShieldAlert, Wrench, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const TONES: Record<"info" | "warning" | "danger" | "pending", { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "border-info/30 bg-info-subtle text-info-text" },
  warning: { icon: AlertTriangle, className: "border-warning/30 bg-warning-subtle text-warning-text" },
  danger: { icon: ShieldAlert, className: "border-danger/35 bg-danger-subtle text-danger-text" },
  pending: { icon: Wrench, className: "border-border bg-surface-raised text-muted-foreground" },
};

/** Aviso contextual (configuração pendente, falha de integração, dados parciais...). */
export function Notice({
  tone,
  title,
  children,
  className,
}: {
  tone: keyof typeof TONES;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = TONES[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3", toneClass, className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1 text-sm">
        <p className="font-medium">{title}</p>
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
