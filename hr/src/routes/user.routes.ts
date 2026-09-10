import { Router } from "express"

import { updateOwnAvatar, updateOwnProfile } from "../controllers/user-profile.controller.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { avatarFileUpload } from "../middleware/upload.js"
import { validateBody } from "../middleware/validate.js"
import { updateOwnProfileSchema } from "../validators/profile.validators.js"

export const usersRouter = Router()

usersRouter.use(authenticate)

usersRouter.patch("/profile", validateBody(updateOwnProfileSchema), asyncHandler(updateOwnProfile))

usersRouter.post("/profile/avatar", avatarFileUpload, asyncHandler(updateOwnAvatar))
