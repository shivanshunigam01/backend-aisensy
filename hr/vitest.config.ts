import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      JWT_ACCESS_SECRET: "test-access-secret-16",
      JWT_REFRESH_SECRET: "test-refresh-secret-16",
      BCRYPT_SALT_ROUNDS: "10",
    },
  },
})
