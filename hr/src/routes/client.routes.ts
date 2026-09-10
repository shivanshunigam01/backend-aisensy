import { Router } from "express"

import {
  createClient,
  deleteClient,
  getClient,
  listClients,
  updateClient,
} from "../controllers/client.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  clientListQuerySchema,
  createClientSchema,
  updateClientSchema,
} from "../validators/client.validators.js"

export const clientsRouter = Router()

clientsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

clientsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(clientListQuerySchema),
  asyncHandler(listClients)
)

clientsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createClientSchema),
  asyncHandler(createClient)
)

clientsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getClient))

clientsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateClientSchema),
  asyncHandler(updateClient)
)

clientsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteClient)
)
