import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as clientService from "../services/client.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  ClientListQueryInput,
  CreateClientInput,
  UpdateClientInput,
} from "../validators/client.validators.js"

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

export async function listClients(req: Request, res: Response) {
  const data = await clientService.listClients(
    requireAuth(req),
    req.validatedQuery as ClientListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getClient(req: Request, res: Response) {
  const client = await clientService.getClient(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { client } })
}

export async function createClient(req: Request, res: Response) {
  const client = await clientService.createClient(
    requireAuth(req),
    req.body as CreateClientInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Client created",
    data: { client },
  })
}

export async function updateClient(req: Request, res: Response) {
  const client = await clientService.updateClient(
    requireAuth(req),
    routeId(req),
    req.body as UpdateClientInput
  )
  return sendSuccess(res, { message: "Client updated", data: { client } })
}

export async function deleteClient(req: Request, res: Response) {
  await clientService.deleteClient(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Client deleted" })
}
