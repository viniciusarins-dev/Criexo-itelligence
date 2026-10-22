"use client";

import { useActionState } from "react";

import { Field, fieldA11y } from "@/components/forms/field";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MATERIALS,
  MODELING_LABELS,
  MODELING_LEVELS,
  PRINT_TIME_BANDS,
  PRINT_TIME_BASES,
  PRINT_TIME_BASIS_LABELS,
  PRINT_TIME_LABELS,
  PRINTER_SCHEDULE_LABELS,
  PRINTER_SCHEDULES,
  SIZE_UNIT_LABELS,
  SIZE_UNITS,
  type ProductionSettings,
} from "@/domain/settings/production";
import { IDLE, pick, pickChecked, type ActionState } from "@/lib/validation/form-data";

import { saveProduction } from "./actions";
import { SaveButton } from "./save-button";

function SectionTitle({ children }: { children: string }) {
  return <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</legend>;
}

export function ProductionForm({ current }: { current: ProductionSettings | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveProduction, IDLE);
  useActionFeedback(state);
  const e = state.fieldErrors ?? {};
  const v = state.values;
  const known = new Set<string>(MATERIALS);
  const otherMaterials = (current?.materials ?? []).filter((material) => !known.has(material)).join(", ");
  const volume = current?.printer.buildVolumeCm;
  const throughput = current?.throughput;
  const volumeError = e["printer.buildVolumeCm.x"] ?? e["printer.buildVolumeCm.y"] ?? e["printer.buildVolumeCm.z"];

  return (
    <form action={action} className="space-y-8" noValidate>
      <fieldset className="grid gap-5 md:grid-cols-2">
        <SectionTitle>Equipamento</SectionTitle>
        <Field label="Modelo da impressora" htmlFor="printerModel" error={e["printer.model"]} className="md:col-span-2">
          <Input {...fieldA11y("printerModel", e["printer.model"])} name="printerModel" defaultValue={pick(v, "printerModel", current?.printer.model)} />
        </Field>
        <Field
          label="Área de impressão (cm)"
          htmlFor="volumeX"
          error={volumeError ? "Informe as três medidas, entre 0 e 200 cm." : undefined}
          hint="Largura × profundidade × altura. Deixe em branco se não souber."
          className="md:col-span-2"
        >
          <div className="grid grid-cols-3 gap-2">
            <Input {...fieldA11y("volumeX", volumeError, true)} name="volumeX" inputMode="decimal" aria-label="Largura (cm)" placeholder="Largura" defaultValue={pick(v, "volumeX", volume?.x)} />
            <Input name="volumeY" inputMode="decimal" aria-label="Profundidade (cm)" placeholder="Profundidade" defaultValue={pick(v, "volumeY", volume?.y)} aria-invalid={volumeError ? true : undefined} />
            <Input name="volumeZ" inputMode="decimal" aria-label="Altura (cm)" placeholder="Altura" defaultValue={pick(v, "volumeZ", volume?.z)} aria-invalid={volumeError ? true : undefined} />
          </div>
        </Field>
        <Checkbox
          id="modularAssembly"
          name="modularAssembly"
          defaultChecked={pickChecked(v, "modularAssembly", current?.modularAssembly ?? false)}
          label="Peças maiores podem ser feitas em módulos com encaixe"
          description="Uma peça maior que a área de impressão não é descartada automaticamente."
          className="md:col-span-2"
        />
      </fieldset>

      <fieldset className="space-y-3">
        <SectionTitle>Materiais</SectionTitle>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {MATERIALS.map((material) => (
            <Checkbox
              key={material}
              id={`material-${material}`}
              name="materials"
              value={material}
              defaultChecked={pickChecked(v, "materials", current?.materials.includes(material) ?? false, material)}
              label={material}
            />
          ))}
        </div>
        <Field label="Outros materiais" htmlFor="otherMaterials" hint="Separe por vírgula.">
          <Input {...fieldA11y("otherMaterials", undefined, true)} name="otherMaterials" defaultValue={pick(v, "otherMaterials", otherMaterials)} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-5 md:grid-cols-2">
        <SectionTitle>Tempo e prazos</SectionTitle>
        <Field
          label="Horas de trabalho por semana"
          htmlFor="weeklyWorkHours"
          error={e.weeklyWorkHours}
          hint="Preparar, acabar, atender e entregar. Não é o tempo da impressora."
        >
          <Input {...fieldA11y("weeklyWorkHours", e.weeklyWorkHours, true)} name="weeklyWorkHours" inputMode="decimal" defaultValue={pick(v, "weeklyWorkHours", current?.weeklyWorkHours)} />
        </Field>
        <Field label="Prazo padrão de entrega (dias)" htmlFor="standardLeadTimeDays" error={e.standardLeadTimeDays}>
          <Input {...fieldA11y("standardLeadTimeDays", e.standardLeadTimeDays)} name="standardLeadTimeDays" inputMode="numeric" defaultValue={pick(v, "standardLeadTimeDays", current?.standardLeadTimeDays)} />
        </Field>
        <Field label="A impressora fica ligada" htmlFor="printerSchedule">
          <NativeSelect id="printerSchedule" name="printerSchedule" defaultValue={pick(v, "printerSchedule", current?.printerSchedule)}>
            <option value="">A confirmar</option>
            {PRINTER_SCHEDULES.map((schedule) => (
              <option key={schedule} value={schedule}>
                {PRINTER_SCHEDULE_LABELS[schedule]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Modelagem 3D" htmlFor="modeling">
          <NativeSelect id="modeling" name="modeling" defaultValue={pick(v, "modeling", current?.modeling)}>
            <option value="">A confirmar</option>
            {MODELING_LEVELS.map((level) => (
              <option key={level} value={level}>
                {MODELING_LABELS[level]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Checkbox
          id="customProjectsRequireEvaluation"
          name="customProjectsRequireEvaluation"
          defaultChecked={pickChecked(v, "customProjectsRequireEvaluation", current?.customProjectsRequireEvaluation ?? false)}
          label="Projetos criados do zero têm prazo avaliado caso a caso"
          className="md:col-span-2"
        />
      </fieldset>

      <fieldset className="grid gap-5 md:grid-cols-3">
        <SectionTitle>Produção diária de peças pequenas</SectionTitle>
        <Field label="Limite de peça pequena" htmlFor="smallPartLimit" error={e["throughput.smallPartLimit.value"]}>
          <Input {...fieldA11y("smallPartLimit", e["throughput.smallPartLimit.value"])} name="smallPartLimit" inputMode="decimal" defaultValue={pick(v, "smallPartLimit", throughput?.smallPartLimit.value)} />
        </Field>
        <Field label="Unidade do limite" htmlFor="smallPartUnit">
          <NativeSelect id="smallPartUnit" name="smallPartUnit" defaultValue={pick(v, "smallPartUnit", throughput?.smallPartLimit.unit)}>
            <option value="">A confirmar</option>
            {SIZE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {SIZE_UNIT_LABELS[unit]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="O tempo de impressão é contado" htmlFor="printTimeBasis">
          <NativeSelect id="printTimeBasis" name="printTimeBasis" defaultValue={pick(v, "printTimeBasis", throughput?.printTimeBasis)}>
            <option value="">A confirmar</option>
            {PRINT_TIME_BASES.map((basis) => (
              <option key={basis} value={basis}>
                {PRINT_TIME_BASIS_LABELS[basis]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {PRINT_TIME_BANDS.map((band) => (
          <Field
            key={band}
            label={`Peças por dia · ${PRINT_TIME_LABELS[band].toLowerCase()}`}
            htmlFor={`perDay_${band}`}
            error={e[`throughput.smallPartsPerDay.${band}`]}
          >
            <Input
              {...fieldA11y(`perDay_${band}`, e[`throughput.smallPartsPerDay.${band}`])}
              name={`perDay_${band}`}
              inputMode="numeric"
              defaultValue={pick(v, `perDay_${band}`, throughput?.smallPartsPerDay[band])}
            />
          </Field>
        ))}
        <Checkbox
          id="largePartsOnePerPrint"
          name="largePartsOnePerPrint"
          defaultChecked={pickChecked(v, "largePartsOnePerPrint", throughput?.largePartsOnePerPrint ?? false)}
          label="Acima do limite, só é possível imprimir uma peça por vez"
          className="md:col-span-3"
        />
      </fieldset>

      <Field label="Observações" htmlFor="notes" error={e.notes}>
        <Textarea {...fieldA11y("notes", e.notes)} name="notes" rows={3} defaultValue={pick(v, "notes", current?.notes)} />
      </Field>

      <SaveButton label="Salvar capacidade" />
    </form>
  );
}
