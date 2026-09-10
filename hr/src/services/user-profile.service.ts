import { MESSAGES } from "../constants/messages.js"
import { EmployeeModel } from "../models/employee.model.js"
import { UserModel } from "../models/user.model.js"
import type { AuthContext } from "../types/auth.js"
import { AppError } from "../utils/app-error.js"
import { uploadPublicImage } from "../utils/cloudinary.js"
import { getCurrentUser } from "./auth.service.js"
import type { UpdateOwnProfileInput } from "../validators/profile.validators.js"

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { firstName: "", lastName: "" }
  }
  if (parts.length === 1) {
    return { firstName: parts[0] ?? "", lastName: "" }
  }
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") }
}

async function applyProfileImage(userId: string, organizationId: string, profileImage: string) {
  await UserModel.updateOne({ _id: userId, organizationId }, { profileImage })
  await EmployeeModel.updateOne({ userId, organizationId }, { profileImage })
}

export async function updateOwnProfile(auth: AuthContext, input: UpdateOwnProfileInput) {
  const user = await UserModel.findOne({
    _id: auth.userId,
    organizationId: auth.organizationId,
  })

  if (!user) {
    throw AppError.unauthorized()
  }

  const names = splitName(user.name)
  const firstName = input.firstName ?? names.firstName
  const lastName = input.lastName !== undefined ? input.lastName : names.lastName
  const nextName = `${firstName} ${lastName}`.trim()

  if (nextName.length < 2) {
    throw AppError.badRequest("Enter a first name")
  }

  user.name = nextName
  if (input.profileImage !== undefined) {
    user.profileImage = input.profileImage ?? ""
  }
  await user.save()

  const employee = await EmployeeModel.findOne({
    organizationId: auth.organizationId,
    userId: auth.userId,
  })

  if (employee) {
    employee.firstName = firstName
    if (lastName) {
      employee.lastName = lastName
    }
    if (input.phone !== undefined) {
      employee.phone = input.phone ?? ""
    }
    if (input.profileImage !== undefined) {
      employee.profileImage = input.profileImage ?? ""
    }
    if (input.address !== undefined) {
      employee.set("address", {
        ...((employee.address as Record<string, unknown> | undefined) ?? {}),
        ...input.address,
      })
    }
    await employee.save()
  }

  return getCurrentUser(auth.userId)
}

export async function updateOwnAvatar(
  auth: AuthContext,
  file: Express.Multer.File | undefined
) {
  if (!file?.buffer) {
    throw AppError.badRequest(MESSAGES.DOCUMENT_FILE_REQUIRED)
  }

  const uploaded = await uploadPublicImage({
    buffer: file.buffer,
    organizationId: auth.organizationId,
    filename: file.originalname,
    mimeType: file.mimetype,
  })

  await applyProfileImage(auth.userId, auth.organizationId, uploaded.fileUrl)
  return getCurrentUser(auth.userId)
}
