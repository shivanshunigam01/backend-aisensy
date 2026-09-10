import { Router } from "express"

import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from "../controllers/notification.controller.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { validateQuery } from "../middleware/validate.js"
import { notificationListQuerySchema } from "../validators/notification.validators.js"

export const notificationsRouter = Router()

notificationsRouter.use(authenticate)

notificationsRouter.get(
  "/",
  validateQuery(notificationListQuerySchema),
  asyncHandler(listNotifications)
)

notificationsRouter.get("/unread-count", asyncHandler(unreadNotificationCount))

notificationsRouter.post("/read-all", asyncHandler(markAllNotificationsRead))

notificationsRouter.patch("/:id/read", asyncHandler(markNotificationRead))

notificationsRouter.delete("/:id", asyncHandler(deleteNotification))
