import { Router } from "express"

import {
  createInvoice,
  deleteInvoice,
  getInvoice,
  listInvoices,
  updateInvoice,
} from "../controllers/invoice.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createInvoiceSchema,
  invoiceListQuerySchema,
  updateInvoiceSchema,
} from "../validators/invoice.validators.js"

export const invoicesRouter = Router()

invoicesRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

invoicesRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(invoiceListQuerySchema),
  asyncHandler(listInvoices)
)

invoicesRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createInvoiceSchema),
  asyncHandler(createInvoice)
)

invoicesRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getInvoice))

invoicesRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateInvoiceSchema),
  asyncHandler(updateInvoice)
)

invoicesRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteInvoice)
)
