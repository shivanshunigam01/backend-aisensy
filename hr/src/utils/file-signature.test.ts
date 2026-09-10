import { describe, expect, it } from "vitest"

import { bufferMatchesDeclaredType } from "./file-signature.js"

describe("bufferMatchesDeclaredType", () => {
  it("accepts a PDF whose bytes start with %PDF", () => {
    expect(bufferMatchesDeclaredType(Buffer.from("%PDF-1.7\n"), "application/pdf", ".pdf")).toBe(
      true
    )
  })

  it("rejects a PDF claim whose bytes are not a PDF", () => {
    expect(
      bufferMatchesDeclaredType(Buffer.from("MZ executable"), "application/pdf", ".pdf")
    ).toBe(false)
  })

  it("accepts JPEG, PNG, and WebP signatures", () => {
    expect(
      bufferMatchesDeclaredType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg", ".jpg")
    ).toBe(true)
    expect(
      bufferMatchesDeclaredType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
        ".png"
      )
    ).toBe(true)

    const webp = Buffer.alloc(12)
    webp.write("RIFF", 0)
    webp.write("WEBP", 8)
    expect(bufferMatchesDeclaredType(webp, "image/webp", ".webp")).toBe(true)
  })

  it("accepts DOCX as a ZIP container", () => {
    expect(
      bufferMatchesDeclaredType(
        Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".docx"
      )
    ).toBe(true)
  })
})
