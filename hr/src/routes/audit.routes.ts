import { Router } from "express"

import { getAuditLog, listAuditLogs } from "../controllers/audit.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateQuery } from "../middleware/validate.js"
import { auditListQuerySchema } from "../validators/audit.validators.js"

export const auditLogsRouter = Router()

auditLogsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

auditLogsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(auditListQuerySchema),
  asyncHandler(listAuditLogs)
)

auditLogsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getAuditLog))
