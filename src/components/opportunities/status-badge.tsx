import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { CommercialStatus } from "@/domain/opportunities/opportunity";

const TONES: Record<CommercialStatus["category"], BadgeTone> = { open: "neutral", won: "success", lost: "danger" };

export function StatusBadge({ statusKey, statuses }: { statusKey: string; statuses: CommercialStatus[] }) {
  const status = statuses.find((item) => item.key === statusKey);
  return <Badge tone={status ? TONES[status.category] : "neutral"}>{status?.label ?? statusKey}</Badge>;
}
