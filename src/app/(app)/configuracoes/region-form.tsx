"use client";

import { ExternalLink } from "lucide-react";
import { useActionState } from "react";

import { Field, fieldA11y } from "@/components/forms/field";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Input } from "@/components/ui/input";
import type { GeoReference } from "@/domain/settings/geo";
import { IDLE, pick, type ActionState } from "@/lib/validation/form-data";

import { saveRegion } from "./actions";
import { SaveButton } from "./save-button";

export function RegionForm({
  reference,
  radiusKm,
  canEdit,
}: {
  reference: GeoReference | null;
  radiusKm: number | null;
  canEdit: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveRegion, IDLE);
  useActionFeedback(state);
  const errors = state.fieldErrors ?? {};
  const v = state.values;

  const mapUrl = reference
    ? `https://www.openstreetmap.org/?mlat=${reference.latitude}&mlon=${reference.longitude}#map=17/${reference.latitude}/${reference.longitude}`
    : null;

  return (
    <form action={action} className="space-y-5" noValidate>
      <fieldset disabled={!canEdit} className="grid gap-5 md:grid-cols-2">
        <Field label="Endereço do ponto de referência" htmlFor="address" error={errors.address} className="md:col-span-2">
          <Input
            {...fieldA11y("address", errors.address)}
            name="address"
            defaultValue={pick(v, "address", reference?.address)}
            placeholder="Rua, número, bairro, cidade"
            autoComplete="off"
          />
        </Field>

        <Field
          label="Coordenadas (latitude, longitude)"
          htmlFor="coordinates"
          error={errors.coordinates}
          hint="No Google Maps, clique com o botão direito sobre o local e clique nos números para copiar."
        >
          <Input
            {...fieldA11y("coordinates", errors.coordinates, true)}
            name="coordinates"
            inputMode="decimal"
            defaultValue={pick(v, "coordinates", reference ? `${reference.latitude}, ${reference.longitude}` : null)}
            placeholder="-26.27, -48.85"
            autoComplete="off"
          />
        </Field>

        <Field
          label="Raio de atuação (km)"
          htmlFor="radiusKm"
          error={errors.radiusKm}
          hint="Empresas fora do raio continuam aparecendo, mas sem pontos de proximidade."
        >
          <Input
            {...fieldA11y("radiusKm", errors.radiusKm, true)}
            name="radiusKm"
            inputMode="decimal"
            defaultValue={pick(v, "radiusKm", radiusKm)}
            placeholder="Ex.: 10"
          />
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? <SaveButton label="Salvar região" /> : null}
        {mapUrl ? (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary-text underline-offset-4 hover:underline"
          >
            Conferir o ponto no mapa
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </div>
    </form>
  );
}
