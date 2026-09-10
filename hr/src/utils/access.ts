import { USER_ROLES, type UserRole } from "../constants/roles.js"
import {
  ROLE_PERMISSIONS,
  type Permission,
} from "../constants/permissions.js"

export function getPermissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]]
}

export function isSuperAdmin(role: UserRole) {
  return role === USER_ROLES.SUPER_ADMIN
}

export function hasPermission(role: UserRole, permission: Permission) {
  if (isSuperAdmin(role)) {
    return true
  }

  return ROLE_PERMISSIONS[role].includes(permission)
}

export function hasAnyPermission(role: UserRole, permissions: readonly Permission[]) {
  if (permissions.length === 0) {
    return false
  }

  return permissions.some((permission) => hasPermission(role, permission))
}

export function hasAllPermissions(role: UserRole, permissions: readonly Permission[]) {
  if (permissions.length === 0) {
    return false
  }

  return permissions.every((permission) => hasPermission(role, permission))
}
