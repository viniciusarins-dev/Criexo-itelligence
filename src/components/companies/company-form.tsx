"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef } from "react";

import { saveCompany, type CompanyFormState } from "@/app/(app)/empresas/actions";
import { Field, fieldA11y } from "@/components/forms/field";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { BRAZIL_STATES, DUPLICATE_REASON_LABELS } from "@/domain/companies/options";
import { pick, pickChecked } from "@/lib/validation/form-data";

import { SubmitButton } from "./submit-button";

export type CompanyFormDefaults = {
  id?: string;
  name: string;
  cnpj: string;
  segment: string;
  website: string;
  phone: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  coordinates: string;
  locationConfirmed: boolean;
};

const IDLE: CompanyFormState = { status: "idle" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-5 md:grid-cols-2">
      <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

export function CompanyForm({ defaults, cancelHref }: { defaults: CompanyFormDefaults; cancelHref: string }) {
  const [state, action] = useActionState<CompanyFormState, FormData>(saveCompany, IDLE);
  useActionFeedback({ status: state.status === "duplicates" ? "idle" : state.status, message: state.message, submittedAt: state.submittedAt });
  const confirmRef = useRef<HTMLInputElement>(null);
  const e = state.fieldErrors ?? {};
  const v = state.values;
  const isEdit = Boolean(defaults.id);

  return (
    <form action={action} className="space-y-8" noValidate>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input ref={confirmRef} type="hidden" name="confirmDuplicates" value="0" />

      {state.duplicates && state.duplicates.length > 0 ? (
        <div role="alert" className="space-y-3 rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-warning-text">
            <AlertTriangle aria-hidden="true" className="size-4" />
            {state.status === "duplicates" ? "Possível empresa repetida" : "Empresa já cadastrada"}
          </p>
          <ul className="space-y-1.5">
            {state.duplicates.map((candidate) => (
              <li key={candidate.id} className="text-muted-foreground">
                <Link
                  href={`/empresas/${candidate.id}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
                >
                  {candidate.name}
                  <ExternalLink aria-hidden="true" className="size-3" />
                </Link>
                {candidate.location ? ` · ${candidate.location}` : ""} ·{" "}
                {candidate.reasons.map((reason) => DUPLICATE_REASON_LABELS[reason]).join(", ")}
              </li>
            ))}
          </ul>
          {state.status === "duplicates" ? (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Filiais podem ter o mesmo nome ou telefone. Se for outra empresa, continue.
              </p>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (confirmRef.current) confirmRef.current.value = "1";
                }}
              >
                É outra empresa, salvar mesmo assim
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Section title="Identificação">
        <Field label="Nome da empresa" htmlFor="name" error={e.name} className="md:col-span-2">
          <Input {...fieldA11y("name", e.name)} name="name" defaultValue={pick(v, "name", defaults.name)} autoComplete="organization" />
        </Field>
        <Field label="CNPJ" htmlFor="cnpj" error={e.cnpj} hint="Opcional. Aceita o formato com letras.">
          <Input {...fieldA11y("cnpj", e.cnpj, true)} name="cnpj" defaultValue={pick(v, "cnpj", defaults.cnpj)} placeholder="00.000.000/0000-00" />
        </Field>
        <Field label="Segmento" htmlFor="segment" error={e.segment} hint="Ex.: Oficina mecânica, Assistência técnica.">
          <Input {...fieldA11y("segment", e.segment, true)} name="segment" defaultValue={pick(v, "segment", defaults.segment)} />
        </Field>
      </Section>

      <Section title="Contato comercial">
        <Field label="Site" htmlFor="website" error={e.website}>
          <Input {...fieldA11y("website", e.website)} name="website" inputMode="url" defaultValue={pick(v, "website", defaults.website)} placeholder="www.empresa.com.br" />
        </Field>
        <Field label="Telefone comercial" htmlFor="phone" error={e.phone} hint="Não cadastre telefones pessoais.">
          <Input {...fieldA11y("phone", e.phone, true)} name="phone" inputMode="tel" defaultValue={pick(v, "phone", defaults.phone)} placeholder="(47) 3433-0000" />
        </Field>
      </Section>

      <Section title="Localização">
        <Field label="Endereço" htmlFor="address" error={e.address} className="md:col-span-2">
          <Input {...fieldA11y("address", e.address)} name="address" defaultValue={pick(v, "address", defaults.address)} placeholder="Rua, número" />
        </Field>
        <Field label="Bairro" htmlFor="neighborhood" error={e.neighborhood}>
          <Input {...fieldA11y("neighborhood", e.neighborhood)} name="neighborhood" defaultValue={pick(v, "neighborhood", defaults.neighborhood)} />
        </Field>
        <Field label="Cidade" htmlFor="city" error={e.city}>
          <Input {...fieldA11y("city", e.city)} name="city" defaultValue={pick(v, "city", defaults.city)} />
        </Field>
        <Field label="Estado" htmlFor="state" error={e.state}>
          <NativeSelect {...fieldA11y("state", e.state)} name="state" defaultValue={pick(v, "state", defaults.state)}>
            <option value="">—</option>
            {BRAZIL_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="CEP" htmlFor="postalCode" error={e.postalCode}>
          <Input {...fieldA11y("postalCode", e.postalCode)} name="postalCode" inputMode="numeric" defaultValue={pick(v, "postalCode", defaults.postalCode)} placeholder="00000-000" />
        </Field>
        <Field
          label="Coordenadas (latitude, longitude)"
          htmlFor="coordinates"
          error={e.coordinates}
          hint="Necessárias para calcular a distância. No Google Maps, clique com o botão direito no local e copie os números."
          className="md:col-span-2"
        >
          <Input {...fieldA11y("coordinates", e.coordinates, true)} name="coordinates" inputMode="decimal" defaultValue={pick(v, "coordinates", defaults.coordinates)} placeholder="-26.28, -48.87" />
        </Field>
        <Checkbox
          id="locationConfirmed"
          name="locationConfirmed"
          defaultChecked={pickChecked(v, "locationConfirmed", defaults.locationConfirmed)}
          label="Conferi a localização no mapa"
          description="Sem essa conferência, a nota de proximidade fica limitada."
          className="md:col-span-2"
        />
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={isEdit ? "Salvar alterações" : "Cadastrar empresa"} />
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
