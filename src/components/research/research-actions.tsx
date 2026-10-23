"use client";

import { Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { generateAiIdeas } from "@/app/(app)/produtos/actions";
import { rerunResearch, runSearch } from "@/app/(app)/pesquisas/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/validation/form-data";

function useRun(action: () => Promise<ActionState>, onSuccess?: () => void) {
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const result = await action();
      if (result.status === "success") {
        if (result.message) toast.success(result.message);
        onSuccess?.();
      } else toast.error(result.message ?? "Não foi possível concluir a ação.");
    });
  return { pending, run };
}

function Busy({ pending, icon }: { pending: boolean; icon: ReactNode }) {
  return pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : icon;
}

export function GenerateIdeasButton({ researchSessionId }: { researchSessionId: string }) {
  const { pending, run } = useRun(() => generateAiIdeas({ researchSessionId }));
  return (
    <Button onClick={run} disabled={pending}>
      <Busy pending={pending} icon={<Sparkles aria-hidden="true" />} />
      {pending ? "Gerando sugestões…" : "Sugerir ideias com IA"}
    </Button>
  );
}

export function RunSearchButton({ researchSessionId, disabled }: { researchSessionId: string; disabled: boolean }) {
  const { pending, run } = useRun(() => runSearch({ researchSessionId }));
  return (
    <Button onClick={run} disabled={disabled || pending}>
      <Busy pending={pending} icon={<Search aria-hidden="true" />} />
      {pending ? "Buscando empresas…" : "Buscar empresas"}
    </Button>
  );
}

/** Seção 4.3: nova execução cria outra pesquisa; a anterior e seus resultados ficam como estão. */
export function RerunButton({ researchSessionId }: { researchSessionId: string }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun(() => rerunResearch({ researchSessionId }), () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <RefreshCw aria-hidden="true" />
          Executar novamente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Executar a pesquisa novamente?</DialogTitle>
        <DialogDescription>
          Uma nova pesquisa será criada com os mesmos parâmetros e as configurações atuais. As ideias já decididas são
          reaproveitadas. Esta pesquisa e os resultados dela continuam disponíveis.
        </DialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={run} disabled={pending}>
            <Busy pending={pending} icon={<RefreshCw aria-hidden="true" />} />
            Criar nova execução
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
