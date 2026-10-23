import { Badge, type BadgeTone } from "@/components/ui/badge";
import { INFORMATION_STATUS_LABELS, type InformationStatus } from "@/domain/types/information";

const TONES: Record<InformationStatus, BadgeTone> = {
  confirmed: "success",
  source_declared: "info",
  ai_inference: "warning",
  outdated: "warning",
  unknown: "neutral",
};

/** RN-12: deixa visível a natureza de cada informação. */
export function InformationBadge({ status }: { status: InformationStatus }) {
  return <Badge tone={TONES[status]}>{INFORMATION_STATUS_LABELS[status]}</Badge>;
}
