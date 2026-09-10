import cookieParser from "cookie-parser"
import cors from "cors"
import express from "express"
import helmet from "helmet"
import morgan from "morgan"

import { corsOptions } from "./config/cors.js"
import { env, isProduction } from "./config/env.js"
import { errorHandler } from "./middleware/error-handler.js"
import { notFoundHandler } from "./middleware/not-found.js"
import { globalLimiter } from "./middleware/rate-limit.js"
import { createApiRouter } from "./routes/index.js"

export function createApp() {
  const app = express()

  app.disable("x-powered-by")
  app.set("trust proxy", env.TRUST_PROXY)

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    })
  )
  app.use(cors(corsOptions))
  app.use(
    morgan(isProduction ? "combined" : "dev", {
      skip: (req) => req.path.includes("/health"),
    })
  )
  app.use(cookieParser())
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }))
  app.use(express.urlencoded({ extended: false, limit: env.JSON_BODY_LIMIT }))
  app.use(globalLimiter)
  app.use(env.API_PREFIX, createApiRouter())
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
