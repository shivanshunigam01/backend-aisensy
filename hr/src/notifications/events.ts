import { DOCUMENT_EXPIRING_DAYS } from "../constants/documents.js"
import { USER_ROLES, type UserRole } from "../constants/roles.js"
import { DocumentModel } from "../models/document.model.js"
import { EmployeeModel } from "../models/employee.model.js"
import { UserModel } from "../models/user.model.js"
import { addUtcDays, dateKeyFromDate, dateKeyInTimeZone, utcDateFromKey } from "../utils/dates.js"
import { notify, notifyMany, notifyOnce } from "./notify.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

async function orgUserIds(organizationId: string, roles?: UserRole[]) {
  const filter: Record<string, unknown> = {
    organizationId,
    isActive: true,
  }
  if (roles?.length) {
    filter.role = { $in: roles }
  }
  const users = await UserModel.find(filter).select("_id").lean()
  return users.map((user) => String(user._id))
}

async function managerUserId(organizationId: string, managerId: unknown) {
  if (!managerId) return null
  const manager = await EmployeeModel.findOne({
    _id: managerId,
    organizationId,
  })
    .select("userId")
    .lean()
  return manager?.userId ? String(manager.userId) : null
}

function withoutActor(userIds: string[], actorUserId?: string) {
  if (!actorUserId) return userIds
  return userIds.filter((id) => id !== actorUserId)
}

export async function notifyLeaveSubmitted(input: {
  organizationId: string
  actorUserId: string
  employeeName: string
  managerId?: unknown
  leaveTypeName: string
  range: string
  requestId: string
}) {
  let recipients: string[] = []
  const manager = await managerUserId(input.organizationId, input.managerId)
  if (manager) {
    recipients = [manager]
  } else {
    recipients = await orgUserIds(input.organizationId, [USER_ROLES.HR_ADMIN, USER_ROLES.SUPER_ADMIN])
  }

  await notifyMany(withoutActor(recipients, input.actorUserId), {
    organizationId: input.organizationId,
    title: "Leave request waiting",
    message: `${input.employeeName} asked for ${input.leaveTypeName} · ${input.range}.`,
    type: "leave",
    link: "/leave",
    metadata: { entityId: input.requestId, event: "leave.submitted" },
  })
}

export async function notifyLeaveDecided(input: {
  organizationId: string
  actorUserId: string
  employeeUserId?: unknown
  approved: boolean
  leaveTypeName: string
  range: string
  requestId: string
}) {
  const userId = asId(input.employeeUserId)
  if (!userId || userId === input.actorUserId) return

  await notify({
    userId,
    organizationId: input.organizationId,
    title: input.approved ? "Leave approved" : "Leave rejected",
    message: input.approved
      ? `Your ${input.leaveTypeName} request (${input.range}) was approved.`
      : `Your ${input.leaveTypeName} request (${input.range}) was declined.`,
    type: "leave",
    link: "/leave",
    metadata: {
      entityId: input.requestId,
      event: input.approved ? "leave.approved" : "leave.rejected",
    },
  })
}

export async function notifyAnnouncementPublished(input: {
  organizationId: string
  actorUserId: string
  announcementId: string
  title: string
  excerpt: string
  targetAudience: UserRole[]
}) {
  const recipients = await orgUserIds(
    input.organizationId,
    input.targetAudience.length > 0 ? input.targetAudience : undefined
  )

  await notifyMany(withoutActor(recipients, input.actorUserId), {
    organizationId: input.organizationId,
    title: "New announcement",
    message: input.excerpt || input.title,
    type: "announcement",
    link: `/announcements/${input.announcementId}`,
    metadata: {
      entityId: input.announcementId,
      event: "announcement.published",
      dedupeKey: `announcement.published:${input.announcementId}`,
    },
  })
}

export async function notifyDocumentExpiry(input: {
  organizationId: string
  employeeUserId?: unknown
  documentId: string
  name: string
  expiryLabel: string
  expired: boolean
}) {
  const userId = asId(input.employeeUserId)
  if (!userId) return

  await notifyOnce({
    userId,
    organizationId: input.organizationId,
    title: input.expired ? "Document expired" : "Document expiring soon",
    message: input.expired
      ? `${input.name} expired on ${input.expiryLabel}.`
      : `${input.name} expires on ${input.expiryLabel}.`,
    type: "document",
    link: "/documents",
    metadata: {
      entityId: input.documentId,
      event: input.expired ? "document.expired" : "document.expiring",
      dedupeKey: `document.expiry:${input.documentId}:${input.expiryLabel}`,
    },
  })
}

export async function notifyExpiringDocuments(organizationId: string) {
  try {
    const todayKey = dateKeyInTimeZone(new Date(), DEFAULT_TIMEZONE)
    const today = utcDateFromKey(todayKey)
    const soon = addUtcDays(today, DOCUMENT_EXPIRING_DAYS)
    const docs = await DocumentModel.find({
      organizationId,
      expiryDate: { $ne: null, $lte: soon },
    })
      .select("name expiryDate employeeId")
      .populate({ path: "employeeId", select: "userId" })
      .limit(50)
      .lean()

    for (const doc of docs) {
      const expiryKey = doc.expiryDate instanceof Date ? dateKeyFromDate(doc.expiryDate) : ""
      if (!expiryKey) continue
      const employee = doc.employeeId as { userId?: unknown } | null
      await notifyDocumentExpiry({
        organizationId,
        employeeUserId: employee?.userId,
        documentId: String(doc._id),
        name: String(doc.name),
        expiryLabel: expiryKey,
        expired: expiryKey < todayKey,
      })
    }
  } catch {
    // Expiry reminders are best-effort.
  }
}

export async function notifyAttendanceLate(input: {
  organizationId: string
  actorUserId: string
  employeeName: string
  managerId?: unknown
  timeLabel: string
}) {
  const manager = await managerUserId(input.organizationId, input.managerId)
  if (!manager || manager === input.actorUserId) return

  await notify({
    userId: manager,
    organizationId: input.organizationId,
    title: "Late check-in",
    message: `${input.employeeName} checked in late at ${input.timeLabel}.`,
    type: "attendance",
    link: "/attendance",
    metadata: { event: "attendance.late" },
  })
}
