import { vi } from "vitest"

import { getPermissionsForRole } from "../utils/access.js"
import type { AuthContext, UserRole } from "../types/auth.js"

export const IDS = {
  org: "64a000000000000000000001",
  otherOrg: "64a000000000000000000099",
  hrUser: "64a000000000000000000002",
  employeeUser: "64a000000000000000000003",
  managerUser: "64a000000000000000000004",
  employee: "64a000000000000000000005",
  manager: "64a000000000000000000006",
  leave: "64a000000000000000000007",
  leaveType: "64a000000000000000000008",
  attendance: "64a000000000000000000009",
  newUser: "64a00000000000000000000a",
  newEmployee: "64a00000000000000000000b",
  client: "64a00000000000000000000c",
  mandate: "64a00000000000000000000d",
  candidate: "64a00000000000000000000e",
  agreement: "64a00000000000000000000f",
  consent: "64a000000000000000000010",
  evaluation: "64a000000000000000000011",
  submission: "64a000000000000000000012",
  interview: "64a000000000000000000013",
  offer: "64a000000000000000000014",
  followUp: "64a000000000000000000015",
  joining: "64a000000000000000000016",
  invoice: "64a000000000000000000017",
  payment: "64a000000000000000000018",
  guarantee: "64a000000000000000000019",
  job: "64a00000000000000000001a",
  replacementCase: "64a00000000000000000001b",
  replacementCandidate: "64a00000000000000000001c",
  auditLog: "64a00000000000000000001d",
} as const

export function auth(role: UserRole, userId: string): AuthContext {
  return {
    userId,
    organizationId: IDS.org,
    role,
    permissions: getPermissionsForRole(role),
  }
}

export function mockQuery<T>(result: T) {
  const query = {
    select: vi.fn(),
    populate: vi.fn(),
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    lean: vi.fn(),
    then: (
      onFulfilled: (value: T) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  }

  query.select.mockReturnValue(query)
  query.populate.mockReturnValue(query)
  query.sort.mockReturnValue(query)
  query.skip.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.lean.mockResolvedValue(result)

  return query
}
