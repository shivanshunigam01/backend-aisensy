import type { Request, Response } from "express"

import * as notificationService from "../services/notification.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type { NotificationListQueryInput } from "../validators/notification.validators.js"

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

export async function listNotifications(req: Request, res: Response) {
  const data = await notificationService.listNotifications(
    requireAuth(req),
    req.validatedQuery as NotificationListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function unreadNotificationCount(req: Request, res: Response) {
  const data = await notificationService.unreadNotificationCount(requireAuth(req))
  return sendSuccess(res, { data })
}

export async function markNotificationRead(req: Request, res: Response) {
  const data = await notificationService.markNotificationRead(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Notification marked as read", data })
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  const data = await notificationService.markAllNotificationsRead(requireAuth(req))
  return sendSuccess(res, { message: "Notifications marked as read", data })
}

export async function deleteNotification(req: Request, res: Response) {
  await notificationService.deleteNotification(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Notification deleted" })
}
