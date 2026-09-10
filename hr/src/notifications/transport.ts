import type { PublicNotification } from "./types.js"

/**
 * Realtime delivery adapter. REST + Mongo remain the source of truth.
 * Register Socket.io (or another transport) from server bootstrap:
 *
 *   setNotificationTransport({
 *     deliver(notification) {
 *       io.to(`user:${notification.userId}`).emit("notification.created", notification)
 *     },
 *   })
 *
 * Domain code always calls `notify()` / `notifyMany()`. It never talks to Socket.io.
 */
export type NotificationTransport = {
  deliver: (notification: PublicNotification) => void
}

const noopTransport: NotificationTransport = {
  deliver() {},
}

let transport: NotificationTransport = noopTransport

export function setNotificationTransport(next: NotificationTransport) {
  transport = next
}

export function deliverNotification(notification: PublicNotification) {
  try {
    transport.deliver(notification)
  } catch {
    // Realtime delivery must not fail the write path.
  }
}
