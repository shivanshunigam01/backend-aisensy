export const GENDERS = ["male", "female", "non_binary", "prefer_not_to_say"] as const

export type Gender = (typeof GENDERS)[number]

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern"] as const

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const EMPLOYMENT_STATUSES = ["active", "inactive", "on_leave", "terminated"] as const

export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number]

export const WORK_LOCATIONS = ["office", "remote", "hybrid"] as const

export type WorkLocation = (typeof WORK_LOCATIONS)[number]

export const EMERGENCY_RELATIONSHIPS = [
  "spouse",
  "parent",
  "sibling",
  "child",
  "friend",
  "other",
] as const

export type EmergencyRelationship = (typeof EMERGENCY_RELATIONSHIPS)[number]

export const EMPLOYABLE_ROLES = ["HR_ADMIN", "MANAGER", "EMPLOYEE"] as const

export type EmployableRole = (typeof EMPLOYABLE_ROLES)[number]
