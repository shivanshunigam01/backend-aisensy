import { Router } from "express"

import { getDashboard, getRecruitmentDashboard } from "../controllers/dashboard.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateQuery } from "../middleware/validate.js"
import { recruitmentDashboardQuerySchema } from "../validators/recruitment-dashboard.validators.js"

export const dashboardRouter = Router()

dashboardRouter.use(authenticate)

dashboardRouter.get(
  "/",
  authorizePermissions(PERMISSIONS.DASHBOARD_READ),
  asyncHandler(getDashboard)
)

const canReadRecruitment = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

dashboardRouter.get(
  "/recruitment",
  authorizePermissions(...canReadRecruitment),
  validateQuery(recruitmentDashboardQuerySchema),
  asyncHandler(getRecruitmentDashboard)
)

