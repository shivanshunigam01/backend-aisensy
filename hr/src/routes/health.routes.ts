import { Router } from "express"

import { getHealth, getReady } from "../controllers/health.controller.js"
import { asyncHandler } from "../middleware/async-handler.js"

export const healthRouter = Router()

healthRouter.get("/", asyncHandler(getHealth))
healthRouter.get("/ready", asyncHandler(getReady))
