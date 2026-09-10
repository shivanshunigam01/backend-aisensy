import type { ZodError } from "zod"

import { MESSAGES } from "../constants/messages.js"
import { AppError } from "./app-error.js"

function firstFlattenMessage(flatten: ReturnType<ZodError["flatten"]>) {
  const fieldMessages = Object.values(flatten.fieldErrors).flatMap((value) =>
    Array.isArray(value) ? value : []
  )

  return (
    flatten.formErrors.find(Boolean) ??
    fieldMessages.find((message) => Boolean(message)) ??
    MESSAGES.VALIDATION_ERROR
  )
}

export function validationFromZod(error: ZodError) {
  const flatten = error.flatten()
  return AppError.validation(firstFlattenMessage(flatten), flatten)
}
