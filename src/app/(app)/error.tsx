"use client";

import { RotateCw } from "lucide-react";
import { useEffect } from "react";

import { Notice } from "@/components/states/notice";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Apenas o identificador; detalhes ficam nos logs do servidor.
    console.error("Erro ao renderizar a página", error.digest ?? "");
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 py-12">
      <Notice tone="danger" title="Não foi possível carregar esta página">
        Os dados já registrados não foram afetados. Verifique a conexão com o banco de dados e tente novamente.
        {error.digest ? <span className="mt-1 block text-xs">Código: {error.digest}</span> : null}
      </Notice>
      <div>
        <Button variant="secondary" onClick={reset}>
          <RotateCw aria-hidden="true" />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
