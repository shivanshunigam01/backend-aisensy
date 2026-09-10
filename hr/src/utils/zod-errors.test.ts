import { describe, expect, it } from "vitest"
import { z } from "zod"

import { HTTP_STATUS } from "../constants/http.js"
import { validationFromZod } from "./zod-errors.js"

describe("validationFromZod", () => {
  it("uses the first field message instead of a generic heading", () => {
    const schema = z.object({
      signedDate: z.string(),
    }).superRefine((_value, ctx) => {
      ctx.addIssue({
        code: "custom",
        message: "Signed date cannot be before the effective date",
        path: ["signedDate"],
      })
    })

    const parsed = schema.safeParse({ signedDate: "1974-07-28" })
    expect(parsed.success).toBe(false)
    if (parsed.success) return

    const error = validationFromZod(parsed.error)
    expect(error.statusCode).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY)
    expect(error.message).toBe("Signed date cannot be before the effective date")
    expect(error.errors).toMatchObject({
      fieldErrors: {
        signedDate: ["Signed date cannot be before the effective date"],
      },
    })
  })
})
