import { AssetModel } from "../models/asset.model.js"

export async function generateAssetCode(organizationId: string) {
  const last = await AssetModel.findOne({
    organizationId,
    assetCode: /^AST-\d+$/,
  })
    .sort({ assetCode: -1 })
    .select("assetCode")
    .lean()

  const current = last?.assetCode?.match(/^AST-(\d+)$/)?.[1]
  const next = current ? Number(current) + 1 : 1

  return `AST-${String(next).padStart(4, "0")}`
}
