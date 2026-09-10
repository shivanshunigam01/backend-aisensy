import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { createEmployeeSchema } from "../validators/employee.validators.js"
import { AppError } from "../utils/app-error.js"
import type { Request, Response } from "express"

vi.mock("../models/user.model.js", () => ({
  UserModel: {
    findOne: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
  },
}))

vi.mock("../models/employee.model.js", () => ({
  EmployeeModel: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("../models/department.model.js", () => ({
  DepartmentModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/designation.model.js", () => ({
  DesignationModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("./leave.service.js", () => ({
  ensureEmployeeLeaveBalances: vi.fn().mockResolvedValue(undefined),
}))

const { UserModel } = await import("../models/user.model.js")
const { EmployeeModel } = await import("../models/employee.model.js")
const { createEmployee } = await import("./employee.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const employeeAuth = auth("EMPLOYEE", IDS.employeeUser)

const input = {
  firstName: "Grace",
  lastName: "Hopper",
  email: "grace@example.com",
  password: "CorrectHorse1",
}

const populatedEmployee = {
  _id: IDS.newEmployee,
  id: IDS.newEmployee,
  organizationId: IDS.org,
  userId: {
    _id: IDS.newUser,
    name: "Grace Hopper",
    email: "grace@example.com",
    role: "EMPLOYEE",
    isActive: true,
  },
  employeeCode: "EMP-0001",
  firstName: "Grace",
  lastName: "Hopper",
  profileImage: "",
  phone: "",
  dateOfBirth: null,
  gender: null,
  address: {},
  departmentId: null,
  designationId: null,
  managerId: null,
  joiningDate: null,
  employmentType: "full_time",
  employmentStatus: "active",
  workLocation: "office",
  emergencyContact: {},
  createdAt: new Date("2026-08-26T10:00:00.000Z"),
  updatedAt: new Date("2026-08-26T10:00:00.000Z"),
}

function runAuthorize(roleAuth: typeof hr) {
  const middleware = authorizePermissions(PERMISSIONS.EMPLOYEES_MANAGE)
  const req = { auth: roleAuth } as Request
  return new Promise<void>((resolve, reject) => {
    middleware(req, {} as Response, (error?: unknown) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

describe("employee creation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows HR to create an employee in their own organization", async () => {
    vi.mocked(UserModel.findOne).mockReturnValue(mockQuery(null) as never)
    vi.mocked(EmployeeModel.findOne)
      .mockReturnValueOnce(mockQuery(null) as never)
      .mockReturnValueOnce(mockQuery(populatedEmployee) as never)
    vi.mocked(UserModel.create).mockResolvedValue({
      id: IDS.newUser,
      _id: IDS.newUser,
    } as never)
    vi.mocked(EmployeeModel.create).mockResolvedValue({
      id: IDS.newEmployee,
      _id: IDS.newEmployee,
    } as never)

    const created = await createEmployee(hr, input)

    expect(created.employeeCode).toBe("EMP-0001")
    expect(created.organizationId).toBe(IDS.org)
    expect(UserModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        email: "grace@example.com",
        role: "EMPLOYEE",
      })
    )
    expect(EmployeeModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        employeeCode: "EMP-0001",
      })
    )
  })

  it("rejects a duplicate work email", async () => {
    vi.mocked(UserModel.findOne).mockReturnValue(mockQuery({ _id: IDS.newUser }) as never)

    await expect(createEmployee(hr, input)).rejects.toMatchObject({
      statusCode: 409,
      message: MESSAGES.EMAIL_IN_USE,
    } satisfies Partial<AppError>)
    expect(UserModel.create).not.toHaveBeenCalled()
  })

  it("blocks employees from the create route", async () => {
    await expect(runAuthorize(employeeAuth)).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it("does not allow assigning SUPER_ADMIN through the create payload", () => {
    const parsed = createEmployeeSchema.safeParse({
      ...input,
      role: "SUPER_ADMIN",
    })

    expect(parsed.success).toBe(false)
  })
})
