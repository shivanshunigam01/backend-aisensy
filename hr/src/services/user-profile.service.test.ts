import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"

vi.mock("../models/user.model.js", () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    updateOne: vi.fn(),
  },
}))
vi.mock("../models/employee.model.js", () => ({
  EmployeeModel: {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
}))
vi.mock("../models/organization.model.js", () => ({
  OrganizationModel: {
    findById: vi.fn(),
  },
}))

const { UserModel } = await import("../models/user.model.js")
const { EmployeeModel } = await import("../models/employee.model.js")
const { OrganizationModel } = await import("../models/organization.model.js")
const { updateOwnProfile } = await import("./user-profile.service.js")

const now = new Date("2026-08-30T10:00:00.000Z")
const hr = auth("EMPLOYEE", IDS.employeeUser)

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

function makeEmployee(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.employee,
    organizationId: IDS.org,
    userId: IDS.employeeUser,
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "",
    profileImage: "",
    address: { line1: "", city: "", state: "", country: "" },
    set: vi.fn(function set(this: Record<string, unknown>, key: string, value: unknown) {
      this[key] = value
    }),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("updateOwnProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(OrganizationModel.findById).mockReturnValue(mockQuery({ name: "Acme" }) as never)
  })

  it("updates the authenticated user's name and linked employee record", async () => {
    const user = makeUser()
    const employee = makeEmployee()
    vi.mocked(UserModel.findOne).mockResolvedValue(user as never)
    vi.mocked(EmployeeModel.findOne).mockResolvedValue(employee as never)
    vi.mocked(UserModel.findById).mockResolvedValue(user as never)

    const result = await updateOwnProfile(hr, {
      firstName: "Augusta",
      lastName: "King",
      phone: "9999999999",
      address: { city: "Bengaluru", country: "India" },
    })

    expect(user.name).toBe("Augusta King")
    expect(user.save).toHaveBeenCalled()
    expect(employee.firstName).toBe("Augusta")
    expect(employee.lastName).toBe("King")
    expect(employee.phone).toBe("9999999999")
    expect(employee.save).toHaveBeenCalled()
    expect(result.id).toBe(IDS.employeeUser)
    expect(result.role).toBe("EMPLOYEE")
    expect(result.organizationId).toBe(IDS.org)
  })

  it("does not create or require an employee record for account-only users", async () => {
    const user = makeUser({ role: "SUPER_ADMIN", employeeId: null, name: "Org Admin" })
    vi.mocked(UserModel.findOne).mockResolvedValue(user as never)
    vi.mocked(EmployeeModel.findOne).mockResolvedValue(null)
    vi.mocked(UserModel.findById).mockResolvedValue(user as never)

    const result = await updateOwnProfile(auth("SUPER_ADMIN", IDS.employeeUser), {
      firstName: "Org",
      lastName: "Owner",
    })

    expect(user.name).toBe("Org Owner")
    expect(EmployeeModel.updateOne).not.toHaveBeenCalled()
    expect(result.name).toBe("Org Owner")
  })

  it("rejects a missing authenticated user", async () => {
    vi.mocked(UserModel.findOne).mockResolvedValue(null)

    await expect(
      updateOwnProfile(hr, { firstName: "Ada" })
    ).rejects.toMatchObject({ statusCode: 401 })
  })
})
