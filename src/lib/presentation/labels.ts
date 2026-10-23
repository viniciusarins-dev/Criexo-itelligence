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

export const APPROVAL_STATUS: Record<Enums<"approval_status">, { label: string; tone: BadgeTone }> = {
  pending: { label: "Aguardando decisão", tone: "warning" },
  approved: { label: "Aprovada", tone: "success" },
  rejected: { label: "Rejeitada", tone: "neutral" },
};

export const IDEA_ORIGIN_LABELS: Record<Enums<"idea_origin">, string> = {
  ai: "Sugestão da IA",
  manual: "Cadastro manual",
};

export const SOURCE_RUN_STATUS: Record<Enums<"source_run_status">, { label: string; tone: BadgeTone }> = {
  pending: { label: "Aguardando", tone: "neutral" },
  running: { label: "Em execução", tone: "info" },
  succeeded: { label: "Concluída", tone: "success" },
  failed: { label: "Falhou", tone: "danger" },
  skipped: { label: "Não consultada", tone: "neutral" },
  rate_limited: { label: "Limite de uso atingido", tone: "warning" },
};
