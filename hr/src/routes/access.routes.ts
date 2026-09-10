import { Router } from "express"

import { getAccess } from "../controllers/access.controller.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"

export const accessRouter = Router()

accessRouter.get("/me", authenticate, asyncHandler(getAccess))
