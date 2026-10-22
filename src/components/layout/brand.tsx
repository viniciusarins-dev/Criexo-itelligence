import Image from "next/image";

import symbol from "@/assets/brand/criexo-symbol.png";
import { cn } from "@/lib/utils";

/**
 * Símbolo extraído da imagem enviada pelo Christian (baixa resolução, fundo
 * preto removido). Substituir pelo arquivo original quando disponível —
 * ver DP-18 em docs/DECISOES_PENDENTES.md.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src={symbol}
      alt=""
      aria-hidden="true"
      width={32}
      height={32}
      priority
      className={cn("size-8 shrink-0", className)}
    />
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
