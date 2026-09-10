import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"

vi.mock("../models/organization.model.js", () => ({
  OrganizationModel: {
    findById: vi.fn(),
  },
}))

vi.mock("../models/employee.model.js", () => ({
  EmployeeModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/leave-request.model.js", () => ({
  LeaveRequestModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
}))

vi.mock("../models/leave-type.model.js", () => ({
  LeaveTypeModel: {
    countDocuments: vi.fn(),
    find: vi.fn(),
  },
}))

vi.mock("../models/leave-balance.model.js", () => ({
  LeaveBalanceModel: {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}))

vi.mock("../models/holiday.model.js", () => ({
  HolidayModel: {
    find: vi.fn(),
  },
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../notifications/index.js", () => ({
  notifyLeaveDecided: vi.fn().mockResolvedValue(undefined),
  notifyLeaveSubmitted: vi.fn().mockResolvedValue(undefined),
}))

const { OrganizationModel } = await import("../models/organization.model.js")
const { EmployeeModel } = await import("../models/employee.model.js")
const { LeaveRequestModel } = await import("../models/leave-request.model.js")
const { LeaveTypeModel } = await import("../models/leave-type.model.js")
const { LeaveBalanceModel } = await import("../models/leave-balance.model.js")
const { approveLeave } = await import("./leave.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const manager = auth("MANAGER", IDS.managerUser)
const employeeAuth = auth("EMPLOYEE", IDS.employeeUser)

const org = {
  timezone: "Asia/Kolkata",
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  settings: { weekStartsOn: "monday" },
}

const targetEmployee = {
  _id: IDS.employee,
  firstName: "Ada",
  lastName: "Lovelace",
  profileImage: "",
  employeeCode: "EMP-0001",
  userId: IDS.employeeUser,
  managerId: IDS.manager,
  departmentId: { name: "Engineering" },
}

const populatedRequest = {
  _id: IDS.leave,
  organizationId: IDS.org,
  employeeId: targetEmployee,
  leaveTypeId: { _id: IDS.leaveType, name: "Annual", code: "AL", isPaid: true },
  startDate: new Date("2026-08-10T00:00:00.000Z"),
  endDate: new Date("2026-08-12T00:00:00.000Z"),
  totalDays: 3,
  reason: "Family",
  attachment: "",
  status: "approved",
  approvedBy: { _id: IDS.hrUser, name: "HR Admin" },
  approvalComment: "",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-26T00:00:00.000Z"),
}

function pendingRequest(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.leave,
    organizationId: IDS.org,
    employeeId: IDS.employee,
    leaveTypeId: IDS.leaveType,
    startDate: new Date("2026-08-10T00:00:00.000Z"),
    endDate: new Date("2026-08-12T00:00:00.000Z"),
    totalDays: 3,
    status: "pending",
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function mockBalanceLookups() {
  vi.mocked(LeaveTypeModel.countDocuments).mockResolvedValue(1)
  vi.mocked(LeaveTypeModel.find).mockReturnValue(
    mockQuery([
      {
        _id: IDS.leaveType,
        name: "Annual",
        code: "AL",
        maxDays: 12,
        isPaid: true,
        isActive: true,
      },
    ]) as never
  )
  vi.mocked(LeaveBalanceModel.find).mockReturnValue(
    mockQuery([{ leaveTypeId: IDS.leaveType }]) as never
  )
  vi.mocked(LeaveBalanceModel.findOneAndUpdate).mockResolvedValue({ remaining: 9 } as never)
}

describe("leave approval", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(OrganizationModel.findById).mockReturnValue(mockQuery(org) as never)
    vi.mocked(LeaveRequestModel.findById).mockReturnValue(mockQuery(populatedRequest) as never)
    mockBalanceLookups()
  })

  it("lets HR approve a pending request in the same organization", async () => {
    const request = pendingRequest()
    vi.mocked(LeaveRequestModel.findOne).mockResolvedValue(request as never)
    vi.mocked(EmployeeModel.findOne).mockReturnValue(mockQuery(targetEmployee) as never)

    const result = await approveLeave(hr, IDS.leave, {})

    expect(request.status).toBe("approved")
    expect(request.save).toHaveBeenCalled()
    expect(LeaveBalanceModel.findOneAndUpdate).toHaveBeenCalled()
    expect(result.status).toBe("approved")
    expect(LeaveRequestModel.findOne).toHaveBeenCalledWith({
      _id: IDS.leave,
      organizationId: IDS.org,
    })
  })

  it("lets a manager approve a direct report", async () => {
    const request = pendingRequest()
    vi.mocked(LeaveRequestModel.findOne).mockResolvedValue(request as never)
    vi.mocked(EmployeeModel.findOne)
      .mockReturnValueOnce(mockQuery(targetEmployee) as never)
      .mockReturnValueOnce(mockQuery({ _id: IDS.manager }) as never)

    const result = await approveLeave(manager, IDS.leave, { comment: "Covered" })

    expect(result.status).toBe("approved")
    expect(request.approvalComment).toBe("Covered")
  })

  it("blocks self-approval", async () => {
    const request = pendingRequest()
    vi.mocked(LeaveRequestModel.findOne).mockResolvedValue(request as never)
    vi.mocked(EmployeeModel.findOne).mockReturnValue(
      mockQuery({ ...targetEmployee, userId: IDS.hrUser }) as never
    )

    await expect(approveLeave(hr, IDS.leave, {})).rejects.toMatchObject({
      statusCode: 403,
      message: MESSAGES.LEAVE_CANNOT_APPROVE_SELF,
    })
    expect(request.save).not.toHaveBeenCalled()
  })

  it("rejects approval when the request is not pending", async () => {
    vi.mocked(LeaveRequestModel.findOne).mockResolvedValue(
      pendingRequest({ status: "approved" }) as never
    )

    await expect(approveLeave(hr, IDS.leave, {})).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.LEAVE_NOT_PENDING,
    })
  })

  it("does not approve a request from another organization", async () => {
    vi.mocked(LeaveRequestModel.findOne).mockResolvedValue(null)

    await expect(approveLeave(hr, IDS.leave, {})).rejects.toMatchObject({
      statusCode: 404,
      message: "Leave request not found",
    })
    expect(LeaveRequestModel.findOne).toHaveBeenCalledWith({
      _id: IDS.leave,
      organizationId: IDS.org,
    })
  })

  it("forbids an employee from approving someone else's leave even if they call the service", async () => {
    const request = pendingRequest()
    vi.mocked(LeaveRequestModel.findOne).mockResolvedValue(request as never)
    vi.mocked(EmployeeModel.findOne).mockReturnValue(mockQuery(targetEmployee) as never)

    await expect(approveLeave(employeeAuth, IDS.leave, {})).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(request.save).not.toHaveBeenCalled()
  })
})
