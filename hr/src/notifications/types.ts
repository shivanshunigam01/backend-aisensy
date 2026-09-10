import type { NotificationType } from "../constants/notifications.js"

export type NotificationMetadata = {
  dedupeKey?: string
  entityId?: string
  [key: string]: unknown
}

export type NotifyInput = {
  userId: string
  organizationId: string
  title: string
  message: string
  type: NotificationType
  link?: string
  metadata?: NotificationMetadata
}

export type PublicNotification = {
  id: string
  userId: string
  organizationId: string
  title: string
  message: string
  type: NotificationType
  link: string
  isRead: boolean
  metadata: NotificationMetadata
  createdAt: string
}
