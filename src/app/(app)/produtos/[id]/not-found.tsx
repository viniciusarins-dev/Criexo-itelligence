import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function IdeaNotFound() {
  return (
    <div className="mx-auto max-w-xl py-12">
      <Card>
        <EmptyState
          icon={SearchX}
          title="Ideia não encontrada"
          description="O endereço pode estar errado ou a ideia não está disponível para você."
          action={
            <Button asChild variant="secondary">
              <Link href="/produtos">Voltar para Produtos e ideias</Link>
            </Button>
          }
        />
      </Card>
    </div>
  );
}
