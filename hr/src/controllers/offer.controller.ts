import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as offerService from "../services/offer.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateOfferInput,
  OfferListQueryInput,
  UpdateOfferInput,
} from "../validators/offer.validators.js"

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

export async function listOffers(req: Request, res: Response) {
  const data = await offerService.listOffers(
    requireAuth(req),
    req.validatedQuery as OfferListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getOffer(req: Request, res: Response) {
  const offer = await offerService.getOffer(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { offer } })
}

export async function createOffer(req: Request, res: Response) {
  const offer = await offerService.createOffer(requireAuth(req), req.body as CreateOfferInput)
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Offer recorded",
    data: { offer },
  })
}

export async function updateOffer(req: Request, res: Response) {
  const offer = await offerService.updateOffer(
    requireAuth(req),
    routeId(req),
    req.body as UpdateOfferInput
  )
  return sendSuccess(res, { message: "Offer updated", data: { offer } })
}

export async function deleteOffer(req: Request, res: Response) {
  await offerService.deleteOffer(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Offer deleted" })
}
