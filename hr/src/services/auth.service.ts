import { env, isDevelopment } from "../config/env.js"
import { RESET_TOKEN_TTL_MS } from "../constants/auth.js"
import { MESSAGES } from "../constants/messages.js"
import { USER_ROLES } from "../constants/roles.js"
import { EmployeeModel } from "../models/employee.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import { UserModel } from "../models/user.model.js"
import type { PublicUser } from "../types/auth.js"
import { AppError } from "../utils/app-error.js"
import { getPermissionsForRole } from "../utils/access.js"
import { createRandomToken, hashToken, tokensMatch } from "../utils/crypto.js"
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js"
import { DUMMY_PASSWORD_HASH, verifyPassword } from "../utils/password.js"
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "../validators/auth.validators.js"

type UserRecord = {
  id: string
  organizationId: unknown
  employeeId?: string | null
  name: string
  email: string
  profileImage?: string | null
  role: PublicUser["role"]
  isActive: boolean
  lastLogin?: Date | null
  createdAt: Date
  updatedAt: Date
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)

  return `${base || "org"}-${createRandomToken(3)}`
}

function asUserRecord(user: {
  id: string
  organizationId: unknown
  employeeId?: string | null
  name: string
  email: string
  profileImage?: string | null
  role: string
  isActive: boolean
  lastLogin?: Date | null
  createdAt: Date
  updatedAt: Date
}): UserRecord {
  return {
    id: user.id,
    organizationId: user.organizationId,
    employeeId: user.employeeId ?? null,
    name: user.name,
    email: user.email,
    profileImage: user.profileImage ?? "",
    role: user.role as PublicUser["role"],
    isActive: user.isActive,
    lastLogin: user.lastLogin ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

async function resolveProfileImage(user: UserRecord) {
  if (user.profileImage) {
    return user.profileImage
  }

  const employee = await EmployeeModel.findOne({
    organizationId: String(user.organizationId),
    userId: user.id,
  }).select("profileImage")

  return employee?.profileImage ?? ""
}

async function toPublicUser(user: UserRecord): Promise<PublicUser> {
  const organization = await OrganizationModel.findById(user.organizationId).select("name")
  const profileImage = await resolveProfileImage(user)

  return {
    id: user.id,
    organizationId: String(user.organizationId),
    organizationName: organization?.name ?? null,
    employeeId: user.employeeId ?? null,
    name: user.name,
    email: user.email,
    profileImage,
    role: user.role,
    permissions: getPermissionsForRole(user.role),
    isActive: user.isActive,
    lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

async function issueSession(user: UserRecord) {
  const tokenUser = {
    id: user.id,
    organizationId: String(user.organizationId),
    role: user.role,
  }

  const accessToken = signAccessToken(tokenUser)
  const refreshToken = signRefreshToken(tokenUser)

  await UserModel.findByIdAndUpdate(user.id, {
    refreshTokenHash: hashToken(refreshToken),
  })

  return { accessToken, refreshToken, user: await toPublicUser(user) }
}

export async function register(input: RegisterInput) {
  if (!env.ALLOW_PUBLIC_REGISTER) {
    throw AppError.forbidden(MESSAGES.REGISTRATION_CLOSED)
  }

  const email = input.email.toLowerCase()
  const existing = await UserModel.findOne({ email }).select("_id")

  if (existing) {
    throw AppError.conflict()
  }

  const organization = await OrganizationModel.create({
    name: input.organizationName,
    slug: slugify(input.organizationName),
  })

  const user = await UserModel.create({
    organizationId: organization._id,
    employeeId: input.employeeId ?? null,
    name: input.name,
    email,
    password: input.password,
    role: USER_ROLES.SUPER_ADMIN,
    isActive: true,
    lastLogin: new Date(),
  })

  return issueSession(asUserRecord(user))
}

export async function login(input: LoginInput) {
  const email = input.email.toLowerCase()
  const user = await UserModel.findOne({ email }).select(
    "+password +refreshTokenHash name email profileImage role isActive organizationId employeeId lastLogin createdAt updatedAt"
  )

  const matches = await verifyPassword(input.password, user?.password ?? DUMMY_PASSWORD_HASH)

  if (!user?.password || !matches) {
    throw AppError.unauthorized(MESSAGES.INVALID_CREDENTIALS)
  }

  if (!user.isActive) {
    throw AppError.unauthorized(MESSAGES.ACCOUNT_DISABLED)
  }

  user.lastLogin = new Date()
  await user.save({ validateBeforeSave: false })

  return issueSession(asUserRecord(user))
}

export async function logout(userId: string) {
  await UserModel.findByIdAndUpdate(userId, {
    refreshTokenHash: null,
  })
}

export async function getCurrentUser(userId: string) {
  const user = await UserModel.findById(userId)

  if (!user || !user.isActive) {
    throw AppError.unauthorized()
  }

  return toPublicUser(asUserRecord(user))
}

export async function refreshSession(refreshToken: string | undefined) {
  if (!refreshToken) {
    throw AppError.unauthorized()
  }

  const payload = verifyRefreshToken(refreshToken)
  const user = await UserModel.findById(payload.sub).select(
    "+refreshTokenHash name email profileImage role isActive organizationId employeeId lastLogin createdAt updatedAt"
  )

  if (!user?.refreshTokenHash || !user.isActive) {
    throw AppError.unauthorized()
  }

  if (!tokensMatch(refreshToken, user.refreshTokenHash)) {
    user.refreshTokenHash = null
    await user.save({ validateBeforeSave: false })
    throw AppError.unauthorized()
  }

  return issueSession(asUserRecord(user))
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const email = input.email.toLowerCase()
  const user = await UserModel.findOne({ email }).select("+passwordResetToken +passwordResetExpires")

  if (!user || !user.isActive) {
    return
  }

  const token = createRandomToken()
  user.passwordResetToken = hashToken(token)
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS)
  await user.save({ validateBeforeSave: false })

  if (isDevelopment) {
    console.info(
      `[auth] Password reset link for ${email}: ${env.APP_URL}/reset-password?token=${token}`
    )
  }
}

export async function resetPassword(input: ResetPasswordInput) {
  const hashed = hashToken(input.token)
  const user = await UserModel.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  }).select("+password +passwordResetToken +passwordResetExpires")

  if (!user) {
    throw AppError.badRequest(MESSAGES.RESET_INVALID)
  }

  user.password = input.password
  user.set("passwordResetToken", undefined)
  user.set("passwordResetExpires", undefined)
  user.refreshTokenHash = null
  await user.save()

  return issueSession(asUserRecord(user))
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await UserModel.findById(userId).select("+password")

  if (!user?.password) {
    throw AppError.unauthorized()
  }

  const matches = await verifyPassword(input.currentPassword, user.password)

  if (!matches) {
    throw AppError.unauthorized(MESSAGES.CURRENT_PASSWORD_INVALID)
  }

  user.password = input.newPassword
  user.refreshTokenHash = null
  await user.save()

  return issueSession(asUserRecord(user))
}
