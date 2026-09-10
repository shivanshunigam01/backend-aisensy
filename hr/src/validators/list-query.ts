import { z } from "zod"

export const SORT_ORDERS = ["asc", "desc"] as const

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const optionalSearchQuery = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform(emptyToUndefined)

export const sortOrderQuery = z.enum(SORT_ORDERS).optional()

export function sortFieldQuery<const T extends readonly [string, ...string[]]>(fields: T) {
  return z.enum(fields).optional()
}

export function listControlFields<const T extends readonly [string, ...string[]]>(
  sortFields: T,
  limitDefault = 20
) {
  return {
    search: optionalSearchQuery,
    q: optionalSearchQuery,
    sort: sortFieldQuery(sortFields),
    order: sortOrderQuery,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(limitDefault),
  }
}
