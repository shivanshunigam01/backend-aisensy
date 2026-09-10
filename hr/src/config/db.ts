import mongoose from "mongoose"

import { env, isProduction } from "./env.js"

export async function connectDatabase() {
  mongoose.set("strictQuery", true)
  mongoose.set("autoIndex", !isProduction)

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  })

  console.info(`[${env.APP_NAME}] MongoDB connected`)
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
  console.info(`[${env.APP_NAME}] MongoDB disconnected`)
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1
}
