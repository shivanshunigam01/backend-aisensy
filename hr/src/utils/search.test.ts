import { describe, expect, it } from "vitest"

import { applySearch, mongoSort, resolvedSearch, searchFilter } from "./search.js"

describe("resolvedSearch", () => {
  it("prefers search over q", () => {
    expect(resolvedSearch({ search: " Ada ", q: "other" })).toBe("Ada")
  })

  it("falls back to q", () => {
    expect(resolvedSearch({ q: " INV-2026 " })).toBe("INV-2026")
  })
})

describe("searchFilter", () => {
  it("returns an empty object without a term", () => {
    expect(searchFilter(["name"], "  ")).toEqual({})
  })

  it("escapes regex metacharacters", () => {
    expect(searchFilter(["invoiceNumber"], "INV.1")).toEqual({
      $or: [{ invoiceNumber: /INV\.1/i }],
    })
  })
})

describe("applySearch", () => {
  it("merges with an existing $or using $and", () => {
    const filter: Record<string, unknown> = {
      $or: [{ consentGiven: false }, { withdrawnAt: { $ne: null } }],
    }
    applySearch(filter, ["consentPurpose"], "SOURCING")
    expect(filter.$or).toBeUndefined()
    expect(filter.$and).toHaveLength(2)
  })
})

describe("mongoSort", () => {
  it("keeps the default multi-key sort", () => {
    expect(mongoSort({}, { invoiceDate: -1, createdAt: -1 })).toEqual({
      invoiceDate: -1,
      createdAt: -1,
    })
  })

  it("applies order to the default field", () => {
    expect(mongoSort({ order: "asc" }, { invoiceDate: -1, createdAt: -1 })).toEqual({
      invoiceDate: 1,
      createdAt: -1,
    })
  })

  it("sorts by a requested field", () => {
    expect(mongoSort({ sort: "amount", order: "asc" }, { invoiceDate: -1 })).toEqual({
      amount: 1,
      createdAt: -1,
    })
  })
})
