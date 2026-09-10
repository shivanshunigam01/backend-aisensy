import { Router } from "express"

import {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword,
} from "../controllers/auth.controller.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authLimiter } from "../middleware/rate-limit.js"
import { validateBody } from "../middleware/validate.js"
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validators/auth.validators.js"

export const authRouter = Router()

authRouter.post(
  "/register",
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(register)
)

authRouter.post(
  "/login",
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(login)
)

authRouter.post("/logout", asyncHandler(logout))

authRouter.get("/me", authenticate, asyncHandler(me))

authRouter.post("/refresh", authLimiter, asyncHandler(refresh))

authRouter.post(
  "/forgot-password",
  authLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(forgotPassword)
)

authRouter.post(
  "/reset-password",
  authLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(resetPassword)
)

authRouter.patch(
  "/change-password",
  authenticate,
  authLimiter,
  validateBody(changePasswordSchema),
  asyncHandler(changePassword)
)
