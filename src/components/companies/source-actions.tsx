"use client";

import { BadgeCheck, Loader2, LocateFixed, ScanSearch } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { confirmCompanyLocation, enrichCompanyFromCnpj, geocodeCompany } from "@/app/(app)/empresas/actions";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function useSourceAction(
  action: (input: { companyId: string }) => Promise<{ status: "success" | "error"; message: string }>,
  companyId: string,
  onSuccess?: () => void,
) {
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const result = await action({ companyId });
      if (result.status === "success") {
        toast.success(result.message);
        onSuccess?.();
      } else toast.error(result.message);
    });
  return { pending, run };
}

/** Consultas sob demanda às fontes públicas. Só completam o que está vazio. */
export function SourceActions({
  companyId,
  cnpj,
  canGeocode,
  geocodeHint,
}: {
  companyId: string;
  cnpj: string | null;
  canGeocode: boolean;
  geocodeHint: string;
}) {
  const enrich = useSourceAction(enrichCompanyFromCnpj, companyId);
  const locate = useSourceAction(geocodeCompany, companyId);
  const numericCnpj = cnpj !== null && /^[0-9]{14}$/.test(cnpj);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Button variant="secondary" onClick={enrich.run} disabled={!numericCnpj || enrich.pending}>
          {enrich.pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ScanSearch aria-hidden="true" />}
          Completar pelo CNPJ
        </Button>
        <p className="text-xs text-muted-foreground">
          {numericCnpj
            ? "Consulta a BrasilAPI (dados da Receita Federal). Preenche só segmento e endereço vazios; telefone e e-mail não são importados."
            : cnpj
              ? "A consulta pública ainda não aceita CNPJ com letras."
              : "Cadastre o CNPJ para consultar."}
        </p>
      </div>
      <div className="space-y-2">
        <Button variant="secondary" onClick={locate.run} disabled={!canGeocode || locate.pending}>
          {locate.pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <LocateFixed aria-hidden="true" />}
          Localizar pelo endereço
        </Button>
        <p className="text-xs text-muted-foreground">{geocodeHint}</p>
      </div>
    </div>
  );
}

/** Confirmação humana: só confirme quem conferiu o ponto no mapa ou no local. */
export function ConfirmLocationButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const confirm = useSourceAction(confirmCompanyLocation, companyId, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <BadgeCheck aria-hidden="true" />
          Confirmar localização
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Confirmar a localização?</DialogTitle>
        <DialogDescription>
          Confirme só se você conferiu o ponto no mapa ou no local. A confirmação fica registrada com seu nome e libera a nota máxima de
          proximidade.
        </DialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={confirm.run} disabled={confirm.pending}>
            {confirm.pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
