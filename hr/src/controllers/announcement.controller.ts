import type { Request, Response } from "express"

import * as announcementService from "../services/announcement.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  AnnouncementListQueryInput,
  AnnouncementWriteInput,
  UpdateAnnouncementInput,
} from "../validators/announcement.validators.js"

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

export async function listAnnouncements(req: Request, res: Response) {
  const data = await announcementService.listAnnouncements(
    requireAuth(req),
    req.validatedQuery as AnnouncementListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getAnnouncement(req: Request, res: Response) {
  const data = await announcementService.getAnnouncement(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function createAnnouncement(req: Request, res: Response) {
  const data = await announcementService.createAnnouncement(
    requireAuth(req),
    req.body as AnnouncementWriteInput
  )
  return sendSuccess(res, { message: "Announcement saved", data })
}

export async function updateAnnouncement(req: Request, res: Response) {
  const data = await announcementService.updateAnnouncement(
    requireAuth(req),
    routeId(req),
    req.body as UpdateAnnouncementInput
  )
  return sendSuccess(res, { message: "Announcement updated", data })
}

export async function publishAnnouncement(req: Request, res: Response) {
  const data = await announcementService.publishAnnouncement(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Announcement published", data })
}

export async function unpublishAnnouncement(req: Request, res: Response) {
  const data = await announcementService.unpublishAnnouncement(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Announcement moved to drafts", data })
}

export async function deleteAnnouncement(req: Request, res: Response) {
  await announcementService.deleteAnnouncement(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Announcement deleted" })
}
