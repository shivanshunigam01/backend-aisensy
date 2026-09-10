import type { Request, Response } from "express"

import * as documentService from "../services/document.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import { validationFromZod } from "../utils/zod-errors.js"
import { uploadDocumentSchema } from "../validators/document.validators.js"
import type {
  DocumentListQueryInput,
  UpdateDocumentInput,
} from "../validators/document.validators.js"

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

export async function listDocuments(req: Request, res: Response) {
  const data = await documentService.listDocuments(
    requireAuth(req),
    req.validatedQuery as DocumentListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getDocument(req: Request, res: Response) {
  const data = await documentService.getDocument(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function getDocumentFile(req: Request, res: Response) {
  const data = await documentService.getDocumentFile(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function uploadDocument(req: Request, res: Response) {
  const parsed = uploadDocumentSchema.safeParse(req.body)
  if (!parsed.success) {
    throw validationFromZod(parsed.error)
  }

  const data = await documentService.uploadDocument(requireAuth(req), parsed.data, req.file)
  return sendSuccess(res, { message: "Document uploaded", data })
}

export async function updateDocument(req: Request, res: Response) {
  const data = await documentService.updateDocument(
    requireAuth(req),
    routeId(req),
    req.body as UpdateDocumentInput
  )
  return sendSuccess(res, { message: "Document updated", data })
}

export async function deleteDocument(req: Request, res: Response) {
  await documentService.deleteDocument(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Document deleted" })
}
