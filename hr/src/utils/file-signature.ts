const PDF = Buffer.from("%PDF")
const JPEG = Buffer.from([0xff, 0xd8, 0xff])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const GIF = Buffer.from("GIF8")
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0])
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const WEBP = Buffer.from("WEBP")
const RIFF = Buffer.from("RIFF")

function startsWith(buffer: Buffer, signature: Buffer, offset = 0) {
  if (buffer.length < offset + signature.length) {
    return false
  }

  return buffer.subarray(offset, offset + signature.length).equals(signature)
}

export function bufferMatchesDeclaredType(buffer: Buffer, mimetype: string, extension: string) {
  if (buffer.length < 4) {
    return false
  }

  const ext = extension.toLowerCase()
  const mime = mimetype.toLowerCase()

  if (ext === ".pdf" || mime === "application/pdf") {
    return startsWith(buffer, PDF)
  }

  if (ext === ".jpg" || ext === ".jpeg" || mime === "image/jpeg") {
    return startsWith(buffer, JPEG)
  }

  if (ext === ".png" || mime === "image/png") {
    return startsWith(buffer, PNG)
  }

  if (ext === ".gif" || mime === "image/gif") {
    return startsWith(buffer, GIF)
  }

  if (ext === ".webp" || mime === "image/webp") {
    return startsWith(buffer, RIFF) && startsWith(buffer, WEBP, 8)
  }

  if (ext === ".doc" || mime === "application/msword") {
    return startsWith(buffer, OLE)
  }

  if (
    ext === ".docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return startsWith(buffer, ZIP)
  }

  return false
}
