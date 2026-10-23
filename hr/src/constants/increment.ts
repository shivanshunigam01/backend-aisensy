import type { PerformanceRating } from "./performance.js"

/** Default annual increment % suggested from the latest submitted review rating. */
export const RATING_INCREMENT_PERCENT: Record<PerformanceRating, number> = {
  1: 0,
  2: 2,
  3: 5,
  4: 8,
  5: 12,
}

export function suggestedIncrementPercent(rating: number | null | undefined) {
  if (rating == null || !Number.isFinite(rating)) return 0
  const rounded = Math.round(rating) as PerformanceRating
  if (rounded < 1 || rounded > 5) return 0
  return RATING_INCREMENT_PERCENT[rounded] ?? 0
}
