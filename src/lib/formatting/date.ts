const TIME_ZONE = "America/Sao_Paulo";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

const relativeFormatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** "há 5 minutos", "ontem"... Recebe `now` para manter a função pura. */
export function formatRelative(iso: string, now: Date): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return relativeFormatter.format(diffSeconds, "second");
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return relativeFormatter.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 30) return relativeFormatter.format(Math.round(diffSeconds / 86400), "day");
  return formatDateTime(iso);
}
