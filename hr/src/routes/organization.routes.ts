import { Router } from "express"

import {
  createDepartment,
  createDesignation,
  deleteDepartment,
  deleteDesignation,
  getDepartment,
  getDesignation,
  getOrganization,
  listDepartments,
  listDesignations,
  listMembers,
  updateDepartment,
  updateDesignation,
  updateOrganization,
} from "../controllers/organization.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createDepartmentSchema,
  createDesignationSchema,
  listQuerySchema,
  updateDepartmentSchema,
  updateDesignationSchema,
  updateOrganizationSchema,
} from "../validators/organization.validators.js"

export const organizationRouter = Router()

organizationRouter.use(authenticate)

organizationRouter.get(
  "/",
  authorizePermissions(PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_MANAGE),
  asyncHandler(getOrganization)
)

organizationRouter.patch(
  "/",
  authorizePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validateBody(updateOrganizationSchema),
  asyncHandler(updateOrganization)
)

organizationRouter.get(
  "/members",
  authorizePermissions(PERMISSIONS.DEPARTMENTS_READ, PERMISSIONS.DEPARTMENTS_MANAGE),
  asyncHandler(listMembers)
)

export const departmentRouter = Router()

departmentRouter.use(authenticate)

departmentRouter.get(
  "/",
  authorizePermissions(PERMISSIONS.DEPARTMENTS_READ),
  validateQuery(listQuerySchema),
  asyncHandler(listDepartments)
)

departmentRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.DEPARTMENTS_MANAGE),
  validateBody(createDepartmentSchema),
  asyncHandler(createDepartment)
)

departmentRouter.get(
  "/:id",
  authorizePermissions(PERMISSIONS.DEPARTMENTS_READ),
  asyncHandler(getDepartment)
)

departmentRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.DEPARTMENTS_MANAGE),
  validateBody(updateDepartmentSchema),
  asyncHandler(updateDepartment)
)

departmentRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.DEPARTMENTS_MANAGE),
  asyncHandler(deleteDepartment)
)

export const designationRouter = Router()

designationRouter.use(authenticate)

designationRouter.get(
  "/",
  authorizePermissions(PERMISSIONS.DESIGNATIONS_READ),
  validateQuery(listQuerySchema),
  asyncHandler(listDesignations)
)

designationRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.DESIGNATIONS_MANAGE),
  validateBody(createDesignationSchema),
  asyncHandler(createDesignation)
)

designationRouter.get(
  "/:id",
  authorizePermissions(PERMISSIONS.DESIGNATIONS_READ),
  asyncHandler(getDesignation)
)

designationRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.DESIGNATIONS_MANAGE),
  validateBody(updateDesignationSchema),
  asyncHandler(updateDesignation)
)

designationRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.DESIGNATIONS_MANAGE),
  asyncHandler(deleteDesignation)
)
