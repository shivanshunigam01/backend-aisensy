import { Router } from "express"

import {
  deleteDocument,
  getDocument,
  getDocumentFile,
  listDocuments,
  updateDocument,
  uploadDocument,
} from "../controllers/document.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { documentFileUpload } from "../middleware/upload.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  documentListQuerySchema,
  updateDocumentSchema,
} from "../validators/document.validators.js"

export const documentsRouter = Router()

documentsRouter.use(authenticate)

const canRead = [PERMISSIONS.DOCUMENTS_READ, PERMISSIONS.DOCUMENTS_READ_SELF] as const
const canWrite = [PERMISSIONS.DOCUMENTS_MANAGE, PERMISSIONS.DOCUMENTS_READ_SELF] as const

documentsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(documentListQuerySchema),
  asyncHandler(listDocuments)
)

documentsRouter.post(
  "/",
  authorizePermissions(...canWrite),
  documentFileUpload,
  asyncHandler(uploadDocument)
)

documentsRouter.get("/:id/file", authorizePermissions(...canRead), asyncHandler(getDocumentFile))

documentsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getDocument))

documentsRouter.patch(
  "/:id",
  authorizePermissions(...canWrite),
  validateBody(updateDocumentSchema),
  asyncHandler(updateDocument)
)

documentsRouter.delete("/:id", authorizePermissions(...canWrite), asyncHandler(deleteDocument))
