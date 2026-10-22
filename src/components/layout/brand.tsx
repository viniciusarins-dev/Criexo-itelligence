import { cn } from "@/lib/utils";

/**
 * Marca provisória (símbolo geométrico + logotipo tipográfico).
 * Substituir pelo arquivo oficial do logotipo quando disponível — ver
 * docs/DECISOES_PENDENTES.md.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <circle cx="16" cy="16" r="15" fill="var(--surface-raised)" stroke="var(--border)" />
      <path d="M22.5 9.5A9 9 0 1 0 23 22" fill="none" stroke="var(--palette-orange)" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3.4" fill="var(--palette-amber)" />
    </svg>
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-[0.18em] text-foreground">CRIEXO</span>
        <span className="mt-1 text-[10px] font-medium tracking-[0.22em] text-primary-text uppercase">
          Intelligence
        </span>
      </span>
    </span>
  );
}
