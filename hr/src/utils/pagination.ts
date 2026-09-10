export type PaginationInput = {
  page: number
  limit: number
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function paginationSkip({ page, limit }: PaginationInput) {
  return (page - 1) * limit
}

export function paginationMeta(total: number, { page, limit }: PaginationInput): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit) || 1),
  }
}
