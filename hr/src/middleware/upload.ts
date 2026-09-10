import type { NextFunction, Request, Response } from "express"
import multer from "multer"
import path from "node:path"

import {
  AVATAR_ALLOWED_EXTENSIONS,
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_BYTES,
} from "../constants/profile.js"
import {
  DOCUMENT_ALLOWED_EXTENSIONS,
  DOCUMENT_ALLOWED_MIME_TYPES,
  DOCUMENT_MAX_BYTES,
} from "../constants/documents.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"
import { bufferMatchesDeclaredType } from "../utils/file-signature.js"

const allowedMime = new Set<string>(DOCUMENT_ALLOWED_MIME_TYPES)
const allowedExt = new Set<string>(DOCUMENT_ALLOWED_EXTENSIONS)

function isAllowedFile(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase()
  return allowedMime.has(file.mimetype) && allowedExt.has(ext)
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: DOCUMENT_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (isAllowedFile(file)) {
      callback(null, true)
      return
    }

    callback(AppError.badRequest(MESSAGES.DOCUMENT_TYPE_INVALID))
  },
})

export function documentFileUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      const file = req.file
      if (
        file?.buffer &&
        !bufferMatchesDeclaredType(
          file.buffer,
          file.mimetype,
          path.extname(file.originalname)
        )
      ) {
        next(AppError.badRequest(MESSAGES.DOCUMENT_TYPE_INVALID))
        return
      }

      next()
      return
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(AppError.badRequest(MESSAGES.DOCUMENT_TOO_LARGE))
      return
    }

    if (error instanceof AppError) {
      next(error)
      return
    }

    next(AppError.badRequest(MESSAGES.DOCUMENT_TYPE_INVALID))
  })
}

export function optionalDocumentFileUpload(req: Request, res: Response, next: NextFunction) {
  const contentType = String(req.headers["content-type"] ?? "")
  if (!contentType.includes("multipart/form-data")) {
    next()
    return
  }

  documentFileUpload(req, res, next)
}

const avatarMime = new Set<string>(AVATAR_ALLOWED_MIME_TYPES)
const avatarExt = new Set<string>(AVATAR_ALLOWED_EXTENSIONS)

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AVATAR_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (avatarMime.has(file.mimetype) && avatarExt.has(ext)) {
      callback(null, true)
      return
    }

    callback(AppError.badRequest(MESSAGES.AVATAR_TYPE_INVALID))
  },
})

export function avatarFileUpload(req: Request, res: Response, next: NextFunction) {
  avatarUpload.single("file")(req, res, (error) => {
    if (!error) {
      const file = req.file
      if (
        file?.buffer &&
        !bufferMatchesDeclaredType(
          file.buffer,
          file.mimetype,
          path.extname(file.originalname)
        )
      ) {
        next(AppError.badRequest(MESSAGES.AVATAR_TYPE_INVALID))
        return
      }

      next()
      return
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(AppError.badRequest(MESSAGES.AVATAR_TOO_LARGE))
      return
    }

    if (error instanceof AppError) {
      next(error)
      return
    }

    next(AppError.badRequest(MESSAGES.AVATAR_TYPE_INVALID))
  })
}
