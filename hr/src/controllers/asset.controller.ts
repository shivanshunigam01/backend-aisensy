import type { Request, Response } from "express"

import * as assetService from "../services/asset.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  AssetListQueryInput,
  AssignAssetInput,
  CreateAssetInput,
  ReturnAssetInput,
  UpdateAssetInput,
} from "../validators/asset.validators.js"

function requireAuth(req: Request) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  return req.auth
}

function routeId(req: Request) {
  const id = req.params.id
  if (typeof id !== "string") {
    throw AppError.badRequest("Invalid identifier")
  }
  return id
}

export async function listAssets(req: Request, res: Response) {
  const data = await assetService.listAssets(
    requireAuth(req),
    req.validatedQuery as AssetListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getAsset(req: Request, res: Response) {
  const data = await assetService.getAsset(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function createAsset(req: Request, res: Response) {
  const data = await assetService.createAsset(requireAuth(req), req.body as CreateAssetInput)
  return sendSuccess(res, { message: "Asset created", data })
}

export async function updateAsset(req: Request, res: Response) {
  const data = await assetService.updateAsset(
    requireAuth(req),
    routeId(req),
    req.body as UpdateAssetInput
  )
  return sendSuccess(res, { message: "Asset updated", data })
}

export async function deleteAsset(req: Request, res: Response) {
  await assetService.deleteAsset(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Asset deleted" })
}

export async function assignAsset(req: Request, res: Response) {
  const data = await assetService.assignAsset(
    requireAuth(req),
    routeId(req),
    req.body as AssignAssetInput
  )
  return sendSuccess(res, { message: "Asset assigned", data })
}

export async function returnAsset(req: Request, res: Response) {
  const data = await assetService.returnAsset(
    requireAuth(req),
    routeId(req),
    req.body as ReturnAssetInput
  )
  return sendSuccess(res, { message: "Asset returned", data })
}

export async function listAssetHistory(req: Request, res: Response) {
  const data = await assetService.listAssetHistory(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}
