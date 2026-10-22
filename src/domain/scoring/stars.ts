import type { ScoringConfig } from "./config";

/** Converte a nota (0–100) em estrelas segundo os intervalos configurados. */
export function scoreToStars(score: number, bands: ScoringConfig["starBands"]): number {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError(`Nota fora do intervalo 0–100: ${score}`);
  }
  let stars = bands[0].stars;
  for (const band of bands) {
    if (score >= band.minScore) stars = band.stars;
  }
  return stars;
}
