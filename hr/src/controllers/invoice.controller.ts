import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as invoiceService from "../services/invoice.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateInvoiceInput,
  InvoiceListQueryInput,
  UpdateInvoiceInput,
} from "../validators/invoice.validators.js"

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

export async function listInvoices(req: Request, res: Response) {
  const data = await invoiceService.listInvoices(
    requireAuth(req),
    req.validatedQuery as InvoiceListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getInvoice(req: Request, res: Response) {
  const invoice = await invoiceService.getInvoice(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { invoice } })
}

export async function createInvoice(req: Request, res: Response) {
  const invoice = await invoiceService.createInvoice(
    requireAuth(req),
    req.body as CreateInvoiceInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Invoice recorded",
    data: { invoice },
  })
}

export async function updateInvoice(req: Request, res: Response) {
  const invoice = await invoiceService.updateInvoice(
    requireAuth(req),
    routeId(req),
    req.body as UpdateInvoiceInput
  )
  return sendSuccess(res, { message: "Invoice updated", data: { invoice } })
}

export async function deleteInvoice(req: Request, res: Response) {
  await invoiceService.deleteInvoice(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Invoice deleted" })
}
