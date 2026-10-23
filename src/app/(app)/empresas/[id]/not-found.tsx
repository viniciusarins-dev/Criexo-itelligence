import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function CompanyNotFound() {
  return (
    <div className="mx-auto max-w-xl py-12">
      <Card>
        <EmptyState
          icon={SearchX}
          title="Empresa não encontrada"
          description="O endereço pode estar errado ou a empresa não está disponível para você."
          action={
            <Button asChild variant="secondary">
              <Link href="/empresas">Voltar para Empresas</Link>
            </Button>
          }
        />
      </Card>
    </div>
  );
}
