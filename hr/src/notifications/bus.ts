import { EventEmitter } from "node:events"

import { deliverNotification } from "./transport.js"
import type { PublicNotification } from "./types.js"

/**
 * In-process fan-out for created notifications.
 * Socket.io (later) should listen for `notification.created` or replace the transport.
 */
class NotificationBus extends EventEmitter {
  emitCreated(notification: PublicNotification) {
    this.emit("notification.created", notification)
  }
}

export const notificationBus = new NotificationBus()

notificationBus.on("notification.created", (notification: PublicNotification) => {
  deliverNotification(notification)
})
