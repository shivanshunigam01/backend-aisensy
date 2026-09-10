import { z } from "zod"

import { PASSWORD_MIN_LENGTH } from "../constants/auth.js"

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number")

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.email("Enter a valid email"),
  password: passwordSchema,
  organizationName: z.string().trim().min(2, "Enter an organization name").max(120),
  employeeId: z.string().trim().min(1).max(40).optional(),
})

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
})

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email"),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(16, "Reset token is invalid"),
  password: passwordSchema,
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Choose a different password",
    path: ["newPassword"],
  })

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
