import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/audit-log.model.js", () => ({
  AuditLogModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}))

const { AuditLogModel } = await import("../models/audit-log.model.js")
const { getAuditLog, listAuditLogs } = await import("./audit.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.auditLog,
    id: IDS.auditLog,
    organizationId: IDS.org,
    userId: { _id: IDS.hrUser, name: "HR Admin", email: "hr@example.com", role: "HR_ADMIN" },
    module: "CLIENTS",
    action: "CREATED",
    recordId: IDS.client,
    previousData: null,
    newData: { companyName: "Acme" },
    ipAddress: "203.0.113.10",
    createdAt: now,
    toObject() {
      return this
    },
    ...overrides,
  }
}

describe("audit.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(AuditLogModel.find).mockReturnValue(mockQuery([makeLog()]) as never)
    vi.mocked(AuditLogModel.countDocuments).mockResolvedValue(1)

    const result = await listAuditLogs(hr, {
      module: "CLIENTS",
      page: 1,
      limit: 20,
    })

    expect(AuditLogModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      module: "CLIENTS",
    })
    expect(result.items[0]?.action).toBe("CREATED")
  })

  it("does not return an audit log from another organization", async () => {
    vi.mocked(AuditLogModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getAuditLog(hr, IDS.auditLog)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.AUDIT_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(AuditLogModel.findOne).toHaveBeenCalledWith({
      _id: IDS.auditLog,
      organizationId: IDS.org,
    })
  })
})
