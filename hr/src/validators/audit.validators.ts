import { z } from "zod"

import { AUDIT_ACTIONS, AUDIT_MODULES } from "../constants/audit.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

export const auditListQuerySchema = z.object({
  module: z.enum(AUDIT_MODULES).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  userId: objectIdSchema.optional(),
  recordId: objectIdSchema.optional(),
  ...listControlFields(["createdAt", "module", "action"] as const),
})

export type AuditListQueryInput = z.infer<typeof auditListQuerySchema>
