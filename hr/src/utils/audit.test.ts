import { describe, expect, it, vi, beforeEach } from "vitest"

import { sanitizeAuditPayload, recordAudit } from "./audit.js"
import { auth, IDS } from "../__tests__/helpers.js"

vi.mock("../models/audit-log.model.js", () => ({
  AuditLogModel: {
    create: vi.fn(),
  },
}))

const { AuditLogModel } = await import("../models/audit-log.model.js")

describe("sanitizeAuditPayload", () => {
  it("redacts passwords, tokens, and other secrets", () => {
    const sanitized = sanitizeAuditPayload({
      email: "ada@example.com",
      password: "super-secret",
      refreshToken: "abc",
      nested: { hashedPassword: "hash", name: "Ada" },
    }) as Record<string, unknown>

    expect(sanitized.email).toBe("ada@example.com")
    expect(sanitized.password).toBe("[redacted]")
    expect(sanitized.refreshToken).toBe("[redacted]")
    expect((sanitized.nested as Record<string, unknown>).hashedPassword).toBe("[redacted]")
    expect((sanitized.nested as Record<string, unknown>).name).toBe("Ada")
  })
})

describe("recordAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("stores the actor, module, and sanitized payload", async () => {
    vi.mocked(AuditLogModel.create).mockResolvedValue({} as never)
    const hr = { ...auth("HR_ADMIN", IDS.hrUser), ipAddress: "203.0.113.10" }

    await recordAudit(hr, {
      module: "CLIENTS",
      action: "CREATED",
      recordId: IDS.client,
      newData: { companyName: "Acme", password: "nope" },
    })

    expect(AuditLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        userId: IDS.hrUser,
        module: "CLIENTS",
        action: "CREATED",
        recordId: IDS.client,
        ipAddress: "203.0.113.10",
        newData: expect.objectContaining({
          companyName: "Acme",
          password: "[redacted]",
        }),
      })
    )
  })
})
