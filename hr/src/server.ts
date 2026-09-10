import { connectDatabase, disconnectDatabase } from "./config/db.js"
import { env, isProduction } from "./config/env.js"
import { createApp } from "./app.js"

const app = createApp()

//commit check
async function start() {
  try {
    await connectDatabase()
  } catch (error) {
    console.error(`[${env.APP_NAME}] MongoDB connection failed`, error)
    if (isProduction) {
      process.exit(1)
    }
  }

  const server = app.listen(env.PORT, () => {
    console.info(
      `[${env.APP_NAME}] listening on port ${env.PORT} (${env.NODE_ENV}) ${env.API_PREFIX}`
    )
  })
  // Register Socket.io later with setNotificationTransport({ deliver(n) { io.to(`user:${n.userId}`).emit("notification.created", n) } })

  const shutdown = async (signal: string) => {
    console.info(`[${env.APP_NAME}] ${signal} received, shutting down`)

    server.close(() => {
      void disconnectDatabase().finally(() => {
        process.exit(0)
      })
    })

    setTimeout(() => {
      console.error(`[${env.APP_NAME}] forced shutdown after timeout`)
      process.exit(1)
    }, 10_000).unref()
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT")
  })
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM")
  })
}

process.on("unhandledRejection", (reason) => {
  console.error(`[${env.APP_NAME}] unhandled rejection`, reason)
})

process.on("uncaughtException", (error) => {
  console.error(`[${env.APP_NAME}] uncaught exception`, error)
  process.exit(1)
})

void start()
