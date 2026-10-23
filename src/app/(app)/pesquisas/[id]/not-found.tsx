import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResearchNotFound() {
  return (
    <div className="mx-auto max-w-xl py-12">
      <Card>
        <EmptyState
          icon={SearchX}
          title="Pesquisa não encontrada"
          description="O endereço pode estar errado ou a pesquisa não está disponível para você."
          action={
            <Button asChild variant="secondary">
              <Link href="/pesquisas">Voltar para Pesquisas anteriores</Link>
            </Button>
          }
        />
      </Card>
    </div>
  );
}
