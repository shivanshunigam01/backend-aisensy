import { MESSAGES } from "../constants/messages.js"
import { isDatabaseConnected } from "../config/db.js"

type HealthData = {
  status: "ok" | "degraded"
  database: "connected" | "disconnected"
}

export type HealthPayload = {
  success: boolean
  message: string
  data: HealthData
}

export function getHealthStatus(): HealthPayload {
  const database = isDatabaseConnected() ? "connected" : "disconnected"

  return {
    success: true,
    message: MESSAGES.API_RUNNING,
    data: {
      status: database === "connected" ? "ok" : "degraded",
      database,
    },
  }
}

export function getReadinessStatus(): HealthPayload {
  const health = getHealthStatus()
  const ready = health.data.database === "connected"

  return {
    success: ready,
    message: ready ? MESSAGES.API_RUNNING : "Database unavailable",
    data: health.data,
  }
}
