export type ListSortQuery = {
  search?: string
  q?: string
  sort?: string
  order?: "asc" | "desc"
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function resolvedSearch(query: { search?: string; q?: string } | string | undefined) {
  const value = typeof query === "string" || query === undefined ? query : query.search ?? query.q
  const term = value?.trim()
  return term ? term : undefined
}

export function searchFilter(fields: string[], search?: string) {
  const term = resolvedSearch(search)

  if (!term) {
    return {}
  }

  const regex = new RegExp(escapeRegex(term), "i")
  return {
    $or: fields.map((field) => ({ [field]: regex })),
  }
}

export function applySearch(
  filter: Record<string, unknown>,
  fields: string[],
  search?: string
) {
  const clause = searchFilter(fields, search)
  if (!("$or" in clause)) {
    return filter
  }

  if (filter.$or) {
    const existingAnd = Array.isArray(filter.$and) ? filter.$and : []
    filter.$and = [...existingAnd, { $or: filter.$or }, clause]
    delete filter.$or
    return filter
  }

  Object.assign(filter, clause)
  return filter
}

export function mongoSort(
  query: { sort?: string; order?: "asc" | "desc" },
  defaultSort: Record<string, 1 | -1>
): Record<string, 1 | -1> {
  if (!query.sort && !query.order) {
    return defaultSort
  }

  const field = query.sort ?? Object.keys(defaultSort)[0] ?? "createdAt"
  const dir: 1 | -1 = query.order === "asc" ? 1 : -1
  if (field === "createdAt") {
    return { createdAt: dir }
  }
  return { [field]: dir, createdAt: -1 }
}
