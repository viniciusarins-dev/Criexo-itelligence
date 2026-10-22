import type { BadgeTone } from "@/components/ui/badge";
import type { Enums } from "@/lib/supabase/types";

export const RESEARCH_TYPE_LABELS: Record<Enums<"research_type">, string> = {
  segment: "Por segmento",
  product: "Por produto",
};

export const RESEARCH_STATUS: Record<Enums<"research_status">, { label: string; tone: BadgeTone }> = {
  draft: { label: "Rascunho", tone: "neutral" },
  awaiting_approval: { label: "Aguardando aprovação", tone: "warning" },
  ready: { label: "Pronta para buscar", tone: "info" },
  running: { label: "Em execução", tone: "info" },
  completed: { label: "Concluída", tone: "success" },
  partial: { label: "Resultado parcial", tone: "warning" },
  failed: { label: "Falhou", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

export const ACTIVITY_LABELS: Record<Enums<"activity_type">, string> = {
  status_change: "Mudança de status",
  note: "Observação",
  contact: "Contato registrado",
  saved: "Oportunidade salva",
  unsaved: "Removida dos salvos",
  score_recalculated: "Pontuação recalculada",
};
