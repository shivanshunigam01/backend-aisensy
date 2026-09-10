import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as paymentService from "../services/payment.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreatePaymentInput,
  PaymentListQueryInput,
  UpdatePaymentInput,
} from "../validators/payment.validators.js"

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

export async function listPayments(req: Request, res: Response) {
  const data = await paymentService.listPayments(
    requireAuth(req),
    req.validatedQuery as PaymentListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getPayment(req: Request, res: Response) {
  const payment = await paymentService.getPayment(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { payment } })
}

export async function createPayment(req: Request, res: Response) {
  const payment = await paymentService.createPayment(
    requireAuth(req),
    req.body as CreatePaymentInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Payment recorded",
    data: { payment },
  })
}

export async function updatePayment(req: Request, res: Response) {
  const payment = await paymentService.updatePayment(
    requireAuth(req),
    routeId(req),
    req.body as UpdatePaymentInput
  )
  return sendSuccess(res, { message: "Payment updated", data: { payment } })
}

export async function deletePayment(req: Request, res: Response) {
  await paymentService.deletePayment(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Payment deleted" })
}
