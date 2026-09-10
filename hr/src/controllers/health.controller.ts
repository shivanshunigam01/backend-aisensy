import type { Request, Response } from "express"

import { getHealthStatus, getReadinessStatus } from "../services/health.service.js"
import { HTTP_STATUS } from "../constants/http.js"

export function getHealth(_req: Request, res: Response) {
  return res.status(HTTP_STATUS.OK).json(getHealthStatus())
}

export function getReady(_req: Request, res: Response) {
  const payload = getReadinessStatus()
  return res
    .status(payload.success ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE)
    .json(payload)
}
