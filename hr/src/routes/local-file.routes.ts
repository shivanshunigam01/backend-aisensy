import { Router } from "express"

import { getPublicLocalFile } from "../controllers/local-file.controller.js"
import { asyncHandler } from "../middleware/async-handler.js"

export const publicFilesRouter = Router()

publicFilesRouter.get("/:fileName", asyncHandler(getPublicLocalFile))
