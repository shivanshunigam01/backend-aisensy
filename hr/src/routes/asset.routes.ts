import { Router } from "express"

import {
  assignAsset,
  createAsset,
  deleteAsset,
  getAsset,
  listAssetHistory,
  listAssets,
  returnAsset,
  updateAsset,
} from "../controllers/asset.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  assetListQuerySchema,
  assignAssetSchema,
  createAssetSchema,
  returnAssetSchema,
  updateAssetSchema,
} from "../validators/asset.validators.js"

export const assetsRouter = Router()

assetsRouter.use(authenticate)

const canRead = [
  PERMISSIONS.ASSETS_READ,
  PERMISSIONS.ASSETS_READ_SELF,
  PERMISSIONS.ASSETS_MANAGE,
] as const

assetsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(assetListQuerySchema),
  asyncHandler(listAssets)
)

assetsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.ASSETS_MANAGE),
  validateBody(createAssetSchema),
  asyncHandler(createAsset)
)

assetsRouter.get("/:id/history", authorizePermissions(...canRead), asyncHandler(listAssetHistory))

assetsRouter.post(
  "/:id/assign",
  authorizePermissions(PERMISSIONS.ASSETS_MANAGE),
  validateBody(assignAssetSchema),
  asyncHandler(assignAsset)
)

assetsRouter.post(
  "/:id/return",
  authorizePermissions(PERMISSIONS.ASSETS_MANAGE),
  validateBody(returnAssetSchema),
  asyncHandler(returnAsset)
)

assetsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getAsset))

assetsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.ASSETS_MANAGE),
  validateBody(updateAssetSchema),
  asyncHandler(updateAsset)
)

assetsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.ASSETS_MANAGE),
  asyncHandler(deleteAsset)
)
