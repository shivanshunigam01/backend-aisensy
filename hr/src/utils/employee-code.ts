import { EmployeeModel } from "../models/employee.model.js"

export async function generateEmployeeCode(organizationId: string) {
  const last = await EmployeeModel.findOne({
    organizationId,
    employeeCode: /^EMP-\d+$/,
  })
    .sort({ employeeCode: -1 })
    .select("employeeCode")
    .lean()

  const current = last?.employeeCode?.match(/^EMP-(\d+)$/)?.[1]
  const next = current ? Number(current) + 1 : 1

  return `EMP-${String(next).padStart(4, "0")}`
}
