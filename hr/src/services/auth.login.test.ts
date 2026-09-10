import { beforeEach, describe, expect, it, vi } from "vitest"

import { IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"
import { hashPassword } from "../utils/password.js"

vi.mock("../models/user.model.js", () => ({
  UserModel: {
    findOne: vi.fn(),
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
const { login } = await import("./auth.service.js")

const PASSWORD = "CorrectHorse1"
const now = new Date("2026-08-26T10:00:00.000Z")

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.employeeUser,
    _id: IDS.employeeUser,
    organizationId: IDS.org,
    employeeId: "EMP-0001",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "EMPLOYEE",
    isActive: true,
    lastLogin: null,
    createdAt: now,
    updatedAt: now,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(OrganizationModel.findById).mockReturnValue(mockQuery({ name: "Acme" }) as never)
    vi.mocked(UserModel.findByIdAndUpdate).mockResolvedValue({})
  })

  it("issues a session for valid credentials", async () => {
    const password = await hashPassword(PASSWORD)
    const user = makeUser({ password })
    vi.mocked(UserModel.findOne).mockReturnValue(mockQuery(user) as never)

    const session = await login({ email: "Ada@example.com", password: PASSWORD })

    expect(session.accessToken).toBeTruthy()
    expect(session.refreshToken).toBeTruthy()
    expect(session.user.email).toBe("ada@example.com")
    expect(session.user.organizationName).toBe("Acme")
    expect(user.save).toHaveBeenCalled()
    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(IDS.employeeUser, {
      refreshTokenHash: expect.any(String),
    })
  })

  it("rejects unknown emails with the same invalid-credentials message", async () => {
    vi.mocked(UserModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(login({ email: "missing@example.com", password: PASSWORD })).rejects.toMatchObject({
      statusCode: 401,
      message: MESSAGES.INVALID_CREDENTIALS,
    } satisfies Partial<AppError>)
  })

  it("rejects a wrong password", async () => {
    const password = await hashPassword(PASSWORD)
    vi.mocked(UserModel.findOne).mockReturnValue(mockQuery(makeUser({ password })) as never)

    await expect(
      login({ email: "ada@example.com", password: "WrongPass1" })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: MESSAGES.INVALID_CREDENTIALS,
    })
  })

  it("rejects a disabled account after the password check", async () => {
    const password = await hashPassword(PASSWORD)
    vi.mocked(UserModel.findOne).mockReturnValue(
      mockQuery(makeUser({ password, isActive: false })) as never
    )

    await expect(login({ email: "ada@example.com", password: PASSWORD })).rejects.toMatchObject({
      statusCode: 401,
      message: MESSAGES.ACCOUNT_DISABLED,
    })
  })
})
