import { z } from "zod"

import {
  ASSET_CATEGORIES,
  ASSET_CONDITIONS,
  ASSET_STATUSES,
} from "../constants/assets.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform(emptyToUndefined)
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Use YYYY-MM-DD",
  })

export const createAssetSchema = z.object({
  name: z.string().trim().min(2, "Enter an asset name").max(120),
  assetCode: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers, or dashes")
    .optional()
    .transform(emptyToUndefined),
  category: z.enum(ASSET_CATEGORIES),
  serialNumber: z.string().trim().max(80).optional().transform(emptyToUndefined),
  purchaseDate: optionalDate,
  condition: z.enum(ASSET_CONDITIONS).optional(),
  status: z.enum(["available", "maintenance", "retired"]).optional(),
})

export const updateAssetSchema = createAssetSchema.partial().extend({
  status: z.enum(ASSET_STATUSES).optional(),
})

export const assignAssetSchema = z.object({
  employeeId: objectIdSchema,
  assignedDate: optionalDate,
  notes: z.string().trim().max(400).optional().transform(emptyToUndefined),
})

export const returnAssetSchema = z.object({
  returnedDate: optionalDate,
  notes: z.string().trim().max(400).optional().transform(emptyToUndefined),
  condition: z.enum(ASSET_CONDITIONS).optional(),
  nextStatus: z.enum(["available", "maintenance"]).optional(),
})

export const assetListQuerySchema = z.object({
  category: z.enum(ASSET_CATEGORIES).optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  condition: z.enum(ASSET_CONDITIONS).optional(),
  employeeId: objectIdSchema.optional(),
  ...listControlFields(["createdAt", "name", "assetCode", "status"] as const, 12),
})

export type CreateAssetInput = z.infer<typeof createAssetSchema>
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>
export type AssignAssetInput = z.infer<typeof assignAssetSchema>
export type ReturnAssetInput = z.infer<typeof returnAssetSchema>
export type AssetListQueryInput = z.infer<typeof assetListQuerySchema>
