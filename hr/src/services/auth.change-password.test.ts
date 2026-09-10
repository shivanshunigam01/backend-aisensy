import { beforeEach, describe, expect, it, vi } from "vitest"

import { IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { hashPassword } from "../utils/password.js"

vi.mock("../models/user.model.js", () => ({
  UserModel: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}))
vi.mock("../models/organization.model.js", () => ({
  OrganizationModel: {
    findById: vi.fn(),
  },
}))

const { UserModel } = await import("../models/user.model.js")
const { OrganizationModel } = await import("../models/organization.model.js")
const { changePassword } = await import("./auth.service.js")

const now = new Date("2026-08-30T10:00:00.000Z")

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.employeeUser,
    _id: IDS.employeeUser,
    organizationId: IDS.org,
    employeeId: "EMP-0001",
    name: "Ada Lovelace",
    email: "ada@example.com",
    profileImage: "",
    role: "EMPLOYEE",
    isActive: true,
    lastLogin: now,
    createdAt: now,
    updatedAt: now,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(OrganizationModel.findById).mockReturnValue(mockQuery({ name: "Acme" }) as never)
    vi.mocked(UserModel.findByIdAndUpdate).mockResolvedValue({})
  })

  it("rejects an incorrect current password without leaking details", async () => {
    const user = makeUser({ password: await hashPassword("CorrectHorse1") })
    vi.mocked(UserModel.findById).mockReturnValue(mockQuery(user) as never)

    await expect(
      changePassword(IDS.employeeUser, {
        currentPassword: "WrongPass1",
        newPassword: "NewHorse12",
      })
    ).rejects.toMatchObject({ statusCode: 401, message: MESSAGES.CURRENT_PASSWORD_INVALID })
  })

  it("hashes the new password and issues a fresh session", async () => {
    const user = makeUser({ password: await hashPassword("CorrectHorse1") })
    vi.mocked(UserModel.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    } as never)

    const session = await changePassword(IDS.employeeUser, {
      currentPassword: "CorrectHorse1",
      newPassword: "NewHorse12",
    })

    expect(user.password).toBe("NewHorse12")
    expect(user.refreshTokenHash).toBeNull()
    expect(user.save).toHaveBeenCalled()
    expect(session.accessToken).toBeTruthy()
    expect(session.user.email).toBe("ada@example.com")
  })
})
