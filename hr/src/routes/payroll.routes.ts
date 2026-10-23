import { Router } from "express"

import {
  applyIncrements,
  getIncrementWorksheet,
} from "../controllers/increment.controller.js"
import {
  createSalaryStructure,
  generatePayroll,
  getPayroll,
  getPayslip,
  getSalaryStructure,
  listPayrolls,
  listSalaryStructures,
  markPayrollPaid,
  previewPayroll,
  updateSalaryStructure,
} from "../controllers/payroll.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  applyIncrementsSchema,
  incrementWorksheetQuerySchema,
} from "../validators/increment.validators.js"
import {
  createSalaryStructureSchema,
  generatePayrollSchema,
  payrollListQuerySchema,
  payrollPreviewQuerySchema,
  structureListQuerySchema,
  updateSalaryStructureSchema,
} from "../validators/payroll.validators.js"

export const payrollRouter = Router()

payrollRouter.use(authenticate)

const canRead = [PERMISSIONS.PAYROLL_READ, PERMISSIONS.PAYROLL_MANAGE] as const
const canReadOwn = [
  PERMISSIONS.PAYROLL_READ,
  PERMISSIONS.PAYROLL_MANAGE,
  PERMISSIONS.PAYROLL_READ_SELF,
] as const

const canViewIncrements = [
  PERMISSIONS.PAYROLL_READ,
  PERMISSIONS.PAYROLL_MANAGE,
  PERMISSIONS.PERFORMANCE_MANAGE,
] as const

payrollRouter.get(
  "/increments/worksheet",
  authorizePermissions(...canViewIncrements),
  validateQuery(incrementWorksheetQuerySchema),
  asyncHandler(getIncrementWorksheet)
)

payrollRouter.post(
  "/increments/apply",
  authorizePermissions(PERMISSIONS.PAYROLL_MANAGE),
  validateBody(applyIncrementsSchema),
  asyncHandler(applyIncrements)
)

payrollRouter.get(
  "/",
  authorizePermissions(...canReadOwn),
  validateQuery(payrollListQuerySchema),
  asyncHandler(listPayrolls)
)

payrollRouter.get(
  "/preview",
  authorizePermissions(...canRead),
  validateQuery(payrollPreviewQuerySchema),
  asyncHandler(previewPayroll)
)

payrollRouter.post(
  "/generate",
  authorizePermissions(PERMISSIONS.PAYROLL_MANAGE),
  validateBody(generatePayrollSchema),
  asyncHandler(generatePayroll)
)

payrollRouter.get(
  "/structures",
  authorizePermissions(...canRead),
  validateQuery(structureListQuerySchema),
  asyncHandler(listSalaryStructures)
)

payrollRouter.post(
  "/structures",
  authorizePermissions(PERMISSIONS.PAYROLL_MANAGE),
  validateBody(createSalaryStructureSchema),
  asyncHandler(createSalaryStructure)
)

payrollRouter.get(
  "/structures/:id",
  authorizePermissions(...canRead),
  asyncHandler(getSalaryStructure)
)

payrollRouter.patch(
  "/structures/:id",
  authorizePermissions(PERMISSIONS.PAYROLL_MANAGE),
  validateBody(updateSalaryStructureSchema),
  asyncHandler(updateSalaryStructure)
)

payrollRouter.get("/:id/payslip", authorizePermissions(...canReadOwn), asyncHandler(getPayslip))

payrollRouter.post(
  "/:id/pay",
  authorizePermissions(PERMISSIONS.PAYROLL_MANAGE),
  asyncHandler(markPayrollPaid)
)

payrollRouter.get("/:id", authorizePermissions(...canReadOwn), asyncHandler(getPayroll))
