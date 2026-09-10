import mongoose from "mongoose"

import { AppError } from "./app-error.js"

export function parseObjectId(value: string, message = "Invalid identifier") {
  if (!mongoose.isValidObjectId(value)) {
    throw AppError.badRequest(message)
  }

  return value
}
