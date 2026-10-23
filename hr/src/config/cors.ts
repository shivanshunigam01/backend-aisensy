import type { CorsOptions } from "cors"

import { corsOrigins } from "./env.js"

function isLocalDevOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin)
    return hostname === "localhost" || hostname === "127.0.0.1"
  } catch {
    return false
  }
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true)
      return
    }

    if (corsOrigins.includes(origin)) {
      callback(null, origin)
      return
    }

    if (process.env.NODE_ENV !== "production" && isLocalDevOrigin(origin)) {
      callback(null, origin)
      return
    }

    callback(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204,
}
