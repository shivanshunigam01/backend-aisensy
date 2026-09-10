import { Router } from "express"

import {
  attendance,
  department,
  employeeGrowth,
  leave,
  payroll,
  recruitment,
} from "../controllers/reports.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateQuery } from "../middleware/validate.js"
import { reportQuerySchema } from "../validators/reports.validators.js"

export const reportsRouter = Router()

reportsRouter.use(authenticate)
reportsRouter.use(authorizePermissions(PERMISSIONS.REPORTS_READ))
reportsRouter.use(validateQuery(reportQuerySchema))

reportsRouter.get("/employee-growth", asyncHandler(employeeGrowth))
reportsRouter.get("/attendance", asyncHandler(attendance))
reportsRouter.get("/leave", asyncHandler(leave))
reportsRouter.get("/department", asyncHandler(department))
reportsRouter.get("/recruitment", asyncHandler(recruitment))
reportsRouter.get("/payroll", asyncHandler(payroll))
