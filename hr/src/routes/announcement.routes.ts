import { Router } from "express"

import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  listAnnouncements,
  publishAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement,
} from "../controllers/announcement.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  announcementListQuerySchema,
  announcementWriteSchema,
  updateAnnouncementSchema,
} from "../validators/announcement.validators.js"

export const announcementsRouter = Router()

announcementsRouter.use(authenticate)

const canRead = [PERMISSIONS.ANNOUNCEMENTS_READ, PERMISSIONS.ANNOUNCEMENTS_MANAGE] as const

announcementsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(announcementListQuerySchema),
  asyncHandler(listAnnouncements)
)

announcementsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  validateBody(announcementWriteSchema),
  asyncHandler(createAnnouncement)
)

announcementsRouter.post(
  "/:id/publish",
  authorizePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  asyncHandler(publishAnnouncement)
)

announcementsRouter.post(
  "/:id/unpublish",
  authorizePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  asyncHandler(unpublishAnnouncement)
)

announcementsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getAnnouncement))

announcementsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  validateBody(updateAnnouncementSchema),
  asyncHandler(updateAnnouncement)
)

announcementsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  asyncHandler(deleteAnnouncement)
)
