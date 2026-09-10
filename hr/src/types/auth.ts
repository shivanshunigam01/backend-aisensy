import type { Permission } from "../constants/permissions.js"

export type UserRole = "SUPER_ADMIN" | "HR_ADMIN" | "MANAGER" | "EMPLOYEE"

export type AuthContext = {
  userId: string
  organizationId: string
  role: UserRole
  permissions: Permission[]
  ipAddress?: string
}

export type AccessTokenPayload = {
  sub: string
  organizationId: string
  role: UserRole
  typ: "access"
}

export type RefreshTokenPayload = {
  sub: string
  typ: "refresh"
  jti: string
}

export type PublicUser = {
  id: string
  organizationId: string
  organizationName: string | null
  employeeId: string | null
  name: string
  email: string
  profileImage: string
  role: UserRole
  permissions: Permission[]
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}
