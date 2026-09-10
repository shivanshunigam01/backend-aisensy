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

vi.mock("../models/holiday.model.js", () => ({
  HolidayModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/leave-request.model.js", () => ({
  LeaveRequestModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/attendance.model.js", () => ({
  AttendanceModel: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../notifications/index.js", () => ({
  notifyAttendanceLate: vi.fn().mockResolvedValue(undefined),
}))

const { OrganizationModel } = await import("../models/organization.model.js")
const { EmployeeModel } = await import("../models/employee.model.js")
const { HolidayModel } = await import("../models/holiday.model.js")
const { LeaveRequestModel } = await import("../models/leave-request.model.js")
const { AttendanceModel } = await import("../models/attendance.model.js")
const { checkIn } = await import("./attendance.service.js")

const employeeAuth = auth("EMPLOYEE", IDS.employeeUser)

const employee = {
  _id: IDS.employee,
  firstName: "Ada",
  lastName: "Lovelace",
  profileImage: "",
  employeeCode: "EMP-0001",
  userId: IDS.employeeUser,
  workLocation: "office",
  managerId: null,
  departmentId: { _id: IDS.org, name: "Engineering" },
}

const org = {
  timezone: "Asia/Kolkata",
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  workingHours: { start: "09:30", end: "18:30" },
  settings: { weekStartsOn: "monday" },
}

function attendanceDoc(checkInAt: Date | null) {
  const now = checkInAt ?? new Date()
  return {
    _id: IDS.attendance,
    organizationId: IDS.org,
    employeeId: IDS.employee,
    date: now,
    checkIn: checkInAt,
    checkOut: null,
    breakStartedAt: null,
    breakMinutes: 0,
    workingMinutes: 0,
    overtimeMinutes: 0,
    status: "present",
    notes: "",
    source: "self",
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
  }
}

describe("attendance check-in", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(OrganizationModel.findById).mockReturnValue(mockQuery(org) as never)
    vi.mocked(EmployeeModel.findOne).mockReturnValue(mockQuery(employee) as never)
    vi.mocked(HolidayModel.findOne).mockReturnValue(mockQuery(null) as never)
    vi.mocked(LeaveRequestModel.findOne).mockReturnValue(mockQuery(null) as never)
  })

  it("creates today's attendance when the employee is not yet checked in", async () => {
    const checkedIn = attendanceDoc(new Date())
    vi.mocked(AttendanceModel.findOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(checkedIn as never)
    vi.mocked(AttendanceModel.create).mockResolvedValue({ _id: IDS.attendance } as never)

    const today = await checkIn(employeeAuth, {})

    expect(AttendanceModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        employeeId: IDS.employee,
        checkOut: null,
        source: "self",
      })
    )
    expect(today.sessionStatus).toBe("working")
    expect(today.attendance?.employeeId).toBe(IDS.employee)
  })

  it("rejects a second check-in on the same day", async () => {
    vi.mocked(AttendanceModel.findOne).mockResolvedValue(attendanceDoc(new Date()) as never)

    await expect(checkIn(employeeAuth, {})).rejects.toMatchObject({
      statusCode: 409,
      message: MESSAGES.ALREADY_CHECKED_IN,
    })
    expect(AttendanceModel.create).not.toHaveBeenCalled()
  })

  it("blocks check-in while the employee is on approved leave", async () => {
    vi.mocked(LeaveRequestModel.findOne).mockReturnValue(mockQuery({ _id: IDS.leave }) as never)

    await expect(checkIn(employeeAuth, {})).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.ON_LEAVE_TODAY,
    })
    expect(AttendanceModel.create).not.toHaveBeenCalled()
  })
})
