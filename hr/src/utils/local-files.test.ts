import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import {
  isSafeStoredFileName,
  resolveLocalPublicFile,
  saveLocalCareerResume,
} from "./local-files.js"

describe("local-files", () => {
  const previousUploadDir = process.env.LOCAL_UPLOAD_DIR
  let tempDir = ""

  afterEach(async () => {
    if (previousUploadDir === undefined) {
      delete process.env.LOCAL_UPLOAD_DIR
    } else {
      process.env.LOCAL_UPLOAD_DIR = previousUploadDir
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = ""
    }
  })

  it("accepts UUID file names with an allowed extension", () => {
    expect(isSafeStoredFileName("2c1a7f0a-4b21-4d8e-9c11-0f3a2b1c4d5e.pdf")).toBe(true)
    expect(isSafeStoredFileName("../secret.pdf")).toBe(false)
    expect(isSafeStoredFileName("2c1a7f0a-4b21-4d8e-9c11-0f3a2b1c4d5e.exe")).toBe(false)
  })

  it("rejects path traversal when resolving a stored file", () => {
    expect(resolveLocalPublicFile("../package.json")).toBeNull()
    expect(resolveLocalPublicFile("2c1a7f0a-4b21-4d8e-9c11-0f3a2b1c4d5e.pdf")).toMatch(
      /careers[\\/]2c1a7f0a-4b21-4d8e-9c11-0f3a2b1c4d5e\.pdf$/
    )
  })

  it("writes a resume under the local uploads directory", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "peopleflow-uploads-"))
    process.env.LOCAL_UPLOAD_DIR = tempDir

    const saved = await saveLocalCareerResume({
      buffer: Buffer.from("%PDF-1.7 test"),
      organizationId: "org-1",
      filename: "Ada Lovelace.pdf",
      mimeType: "application/pdf",
    })

    expect(saved.fileName).toBe("Ada Lovelace.pdf")
    expect(saved.publicId).toMatch(/^local:careers\/[0-9a-f-]{36}\.pdf$/)
    expect(saved.fileUrl).toContain("/public/files/")

    const storedName = saved.publicId.replace("local:careers/", "")
    const written = await readFile(path.join(tempDir, "careers", storedName), "utf8")
    expect(written).toContain("%PDF-1.7")
  })
})
