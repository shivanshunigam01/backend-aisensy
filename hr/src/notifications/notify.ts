import mongoose from "mongoose"

import { NotificationModel } from "../models/notification.model.js"
import { notificationBus } from "./bus.js"
import type { NotifyInput, PublicNotification } from "./types.js"

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

export function toPublicNotification(doc: Record<string, unknown>): PublicNotification {
  const metadata =
    doc.metadata && typeof doc.metadata === "object" && !Array.isArray(doc.metadata)
      ? (doc.metadata as PublicNotification["metadata"])
      : {}

  return {
    id: String(doc._id ?? doc.id),
    userId: asId(doc.userId),
    organizationId: asId(doc.organizationId),
    title: String(doc.title),
    message: String(doc.message),
    type: doc.type as PublicNotification["type"],
    link: String(doc.link ?? ""),
    isRead: Boolean(doc.isRead),
    metadata,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ""),
  }
}

function uniqueUserIds(userIds: string[]) {
  return [...new Set(userIds.map((id) => String(id)).filter(Boolean))]
}

async function insertAndEmit(inputs: NotifyInput[]) {
  if (inputs.length === 0) return []

  const rows = await NotificationModel.insertMany(
    inputs.map((input) => ({
      userId: input.userId,
      organizationId: input.organizationId,
      title: input.title,
      message: input.message,
      type: input.type,
      link: input.link ?? "",
      isRead: false,
      metadata: input.metadata ?? {},
    })),
    { ordered: false }
  )

  const notifications = rows.map((row) => toPublicNotification(row.toObject()))
  for (const notification of notifications) {
    notificationBus.emitCreated(notification)
  }
  return notifications
}

export async function notify(input: NotifyInput) {
  try {
    if (!input.userId || !mongoose.isValidObjectId(input.userId)) {
      return null
    }
    const [created] = await insertAndEmit([input])
    return created ?? null
  } catch {
    return null
  }
}

export async function notifyMany(userIds: string[], shared: Omit<NotifyInput, "userId">) {
  try {
    const inputs = uniqueUserIds(userIds).map((userId) => ({
      ...shared,
      userId,
      metadata: shared.metadata
        ? { ...shared.metadata, dedupeKey: shared.metadata.dedupeKey }
        : shared.metadata,
    }))
    return await insertAndEmit(inputs)
  } catch {
    return []
  }
}

export async function notifyOnce(input: NotifyInput & { metadata: { dedupeKey: string } }) {
  try {
    if (!input.userId || !mongoose.isValidObjectId(input.userId)) {
      return null
    }
    const created = await NotificationModel.create({
      userId: input.userId,
      organizationId: input.organizationId,
      title: input.title,
      message: input.message,
      type: input.type,
      link: input.link ?? "",
      isRead: false,
      metadata: input.metadata,
    })
    const notification = toPublicNotification(created.toObject())
    notificationBus.emitCreated(notification)
    return notification
  } catch {
    return null
  }
}
