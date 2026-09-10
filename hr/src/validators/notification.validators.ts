import { z } from "zod"

import { NOTIFICATION_TYPES } from "../constants/notifications.js"
import { listControlFields } from "./list-query.js"

export const notificationListQuerySchema = z.object({
  type: z.enum(NOTIFICATION_TYPES).optional(),
  isRead: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === "true" ? true : value === "false" ? false : undefined)),
  ...listControlFields(["createdAt", "type"] as const),
})

export type NotificationListQueryInput = z.infer<typeof notificationListQuerySchema>
