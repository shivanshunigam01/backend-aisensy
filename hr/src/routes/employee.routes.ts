import { Router } from "express"

import {
  activateEmployee,
  createEmployee,
  deactivateEmployee,
  getEmployee,
  getMyEmployee,
  listEmployees,
  updateEmployee,
} from "../controllers/employee.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createEmployeeSchema,
  employeeListQuerySchema,
  updateEmployeeSchema,
} from "../validators/employee.validators.js"

export const employeeRouter = Router()

employeeRouter.use(authenticate)

const canRead = [
  PERMISSIONS.EMPLOYEES_READ,
  PERMISSIONS.EMPLOYEES_READ_TEAM,
  PERMISSIONS.EMPLOYEES_READ_SELF,
] as const

employeeRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(employeeListQuerySchema),
  asyncHandler(listEmployees)
)

employeeRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  validateBody(createEmployeeSchema),
  asyncHandler(createEmployee)
)

employeeRouter.get("/me", authorizePermissions(...canRead), asyncHandler(getMyEmployee))

employeeRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getEmployee))

employeeRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  validateBody(updateEmployeeSchema),
  asyncHandler(updateEmployee)
)

employeeRouter.patch(
  "/:id/activate",
  authorizePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  asyncHandler(activateEmployee)
)

employeeRouter.patch(
  "/:id/deactivate",
  authorizePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  asyncHandler(deactivateEmployee)
)
