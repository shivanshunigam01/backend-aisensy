import { PERMISSIONS, type Permission } from "./permissions.js"

export type ResourcePolicy = {
  read: Permission[]
  manage: Permission[]
  create?: Permission[]
  selfRead?: Permission[]
  approve?: Permission[]
}

export const RESOURCE_POLICIES = {
  employees: {
    read: [PERMISSIONS.EMPLOYEES_READ, PERMISSIONS.EMPLOYEES_READ_TEAM],
    manage: [PERMISSIONS.EMPLOYEES_MANAGE],
    selfRead: [PERMISSIONS.EMPLOYEES_READ_SELF],
  },
  departments: {
    read: [PERMISSIONS.DEPARTMENTS_READ],
    manage: [PERMISSIONS.DEPARTMENTS_MANAGE],
  },
  designations: {
    read: [PERMISSIONS.DESIGNATIONS_READ],
    manage: [PERMISSIONS.DESIGNATIONS_MANAGE],
  },
  attendance: {
    read: [PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_READ_TEAM],
    manage: [PERMISSIONS.ATTENDANCE_MANAGE],
    selfRead: [PERMISSIONS.ATTENDANCE_READ_SELF],
  },
  leave: {
    read: [
      PERMISSIONS.LEAVE_READ,
      PERMISSIONS.LEAVE_READ_TEAM,
      PERMISSIONS.LEAVE_APPROVE_TEAM,
    ],
    manage: [PERMISSIONS.LEAVE_MANAGE],
    create: [PERMISSIONS.LEAVE_CREATE_SELF, PERMISSIONS.LEAVE_MANAGE],
    selfRead: [PERMISSIONS.LEAVE_READ_SELF, PERMISSIONS.LEAVE_CREATE_SELF],
    approve: [PERMISSIONS.LEAVE_APPROVE_TEAM, PERMISSIONS.LEAVE_MANAGE],
  },
  documents: {
    read: [PERMISSIONS.DOCUMENTS_READ],
    manage: [PERMISSIONS.DOCUMENTS_MANAGE],
    selfRead: [PERMISSIONS.DOCUMENTS_READ_SELF],
  },
  assets: {
    read: [PERMISSIONS.ASSETS_READ],
    manage: [PERMISSIONS.ASSETS_MANAGE],
    selfRead: [PERMISSIONS.ASSETS_READ_SELF],
  },
  announcements: {
    read: [PERMISSIONS.ANNOUNCEMENTS_READ],
    manage: [PERMISSIONS.ANNOUNCEMENTS_MANAGE],
  },
  payroll: {
    read: [PERMISSIONS.PAYROLL_READ],
    manage: [PERMISSIONS.PAYROLL_MANAGE],
  },
  recruitment: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  clients: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  agreements: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  mandates: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  candidates: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  consents: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  evaluations: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  submissions: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  interviews: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  offers: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  followUps: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  joinings: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  invoices: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  payments: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  guarantees: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  replacements: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  auditLogs: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  recruitmentDashboard: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  pipeline: {
    read: [PERMISSIONS.RECRUITMENT_READ],
    manage: [PERMISSIONS.RECRUITMENT_MANAGE],
  },
  performance: {
    read: [PERMISSIONS.PERFORMANCE_READ, PERMISSIONS.PERFORMANCE_READ_TEAM],
    manage: [PERMISSIONS.PERFORMANCE_MANAGE],
    selfRead: [PERMISSIONS.PERFORMANCE_READ_SELF],
  },
  reports: {
    read: [PERMISSIONS.REPORTS_READ],
    manage: [PERMISSIONS.REPORTS_READ],
  },
} as const satisfies Record<string, ResourcePolicy>
