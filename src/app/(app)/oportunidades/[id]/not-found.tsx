import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function OpportunityNotFound() {
  return (
    <div className="mx-auto max-w-xl py-12">
      <Card>
        <EmptyState
          icon={SearchX}
          title="Oportunidade não encontrada"
          description="O endereço pode estar errado ou a oportunidade não está disponível para você."
          action={
            <Button asChild variant="secondary">
              <Link href="/oportunidades">Voltar para Oportunidades</Link>
            </Button>
          }
        />
      </Card>
    </div>
  );
}
