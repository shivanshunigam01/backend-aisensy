import type { CorsOptions } from "cors"

import { corsOrigins } from "./env.js"

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true)
      return
    }

    if (corsOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(null, false)
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}
