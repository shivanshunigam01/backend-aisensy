import { Router } from "express"

import {
  createPayment,
  deletePayment,
  getPayment,
  listPayments,
  updatePayment,
} from "../controllers/payment.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createPaymentSchema,
  paymentListQuerySchema,
  updatePaymentSchema,
} from "../validators/payment.validators.js"

export const paymentsRouter = Router()

paymentsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

paymentsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(paymentListQuerySchema),
  asyncHandler(listPayments)
)

paymentsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createPaymentSchema),
  asyncHandler(createPayment)
)

paymentsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getPayment))

paymentsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updatePaymentSchema),
  asyncHandler(updatePayment)
)

paymentsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deletePayment)
)
