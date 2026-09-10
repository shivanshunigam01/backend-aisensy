import { config } from "dotenv"
import { z } from "zod"

config({ quiet: true })

const booleanFromEnv = (fallback: boolean) =>
  z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? fallback : value === "true"))

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    APP_NAME: z.string().min(1).default("PeopleFlow API"),
    API_PREFIX: z.string().min(1).default("/api/v1"),
    APP_URL: z.string().min(1).default("http://localhost:3000"),
    TRUST_PROXY: booleanFromEnv(process.env.NODE_ENV === "production"),
    MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/peopleflow"),
    CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
    COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
    COOKIE_DOMAIN: z.string().optional().default(""),
    ALLOW_PUBLIC_REGISTER: booleanFromEnv(true),
    JSON_BODY_LIMIT: z.string().min(1).default("1mb"),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_EXPIRES_IN: z.string().min(1).default("24h"),
    JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("7d"),
    JWT_ISSUER: z.string().min(1).default("peopleflow"),
    JWT_AUDIENCE: z.string().min(1).default("peopleflow-api"),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    REFRESH_COOKIE_MAX_AGE_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(7 * 24 * 60 * 60 * 1000),
    CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
    CLOUDINARY_API_KEY: z.string().optional().default(""),
    CLOUDINARY_API_SECRET: z.string().optional().default(""),
    CLOUDINARY_FOLDER: z.string().min(1).default("peopleflow"),
    AI_PROVIDER: z.enum(["openai", "mock"]).default("mock"),
    OPENAI_API_KEY: z.string().optional().default(""),
    OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
    AI_INTERVIEW_PASSING_SCORE: z.coerce.number().int().min(0).max(100).default(70),
    AI_INTERVIEW_EXPIRY_HOURS: z.coerce.number().int().min(1).max(720).default(72),
    SMTP_HOST: z.string().optional().default(""),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USER: z.string().optional().default(""),
    SMTP_PASS: z.string().optional().default(""),
    SMTP_FROM: z.string().optional().default(""),
    SMTP_SECURE: booleanFromEnv(false),
  })
  .superRefine((value, ctx) => {
    if (value.COOKIE_SAMESITE === "none" && value.NODE_ENV === "production" && !value.TRUST_PROXY) {
      ctx.addIssue({
        code: "custom",
        path: ["COOKIE_SAMESITE"],
        message: "COOKIE_SAMESITE=none in production should run behind HTTPS (TRUST_PROXY=true)",
      })
    }

    if (value.NODE_ENV !== "production") {
      return
    }

    if (value.JWT_ACCESS_SECRET.length < 32) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_ACCESS_SECRET"],
        message: "JWT_ACCESS_SECRET must be at least 32 characters in production",
      })
    }

    if (value.JWT_REFRESH_SECRET.length < 32) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "JWT_REFRESH_SECRET must be at least 32 characters in production",
      })
    }

    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "JWT_REFRESH_SECRET must be different from JWT_ACCESS_SECRET",
      })
    }

    if (!process.env.MONGODB_URI) {
      ctx.addIssue({
        code: "custom",
        path: ["MONGODB_URI"],
        message: "MONGODB_URI must be set in production",
      })
    }

    if (!process.env.CORS_ORIGIN) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGIN"],
        message: "CORS_ORIGIN must be set in production",
      })
    }
  })

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("Invalid environment configuration:")
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data

export const isProduction = env.NODE_ENV === "production"
export const isDevelopment = env.NODE_ENV === "development"

export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
