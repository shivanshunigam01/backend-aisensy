export const PAYROLL_STATUSES = ["generated", "paid"] as const

export type PayrollStatus = (typeof PAYROLL_STATUSES)[number]

export const PAYROLL_CURRENCY = "INR"

export const PAYROLL_CURRENCY_LOCALE = "en-IN"

export const PAYROLL_COMPONENT_KINDS = ["earning", "deduction"] as const

export type PayrollComponentKind = (typeof PAYROLL_COMPONENT_KINDS)[number]

export type PayrollComponentKey =
  | "basicSalary"
  | "hra"
  | "allowances"
  | "bonus"
  | "deductions"

export type PayrollComponentDef = {
  key: PayrollComponentKey
  label: string
  kind: PayrollComponentKind
}

export const EARNING_COMPONENTS = [
  { key: "basicSalary", label: "Basic salary", kind: "earning" },
  { key: "hra", label: "House rent allowance", kind: "earning" },
  { key: "allowances", label: "Allowances", kind: "earning" },
  { key: "bonus", label: "Bonus", kind: "earning" },
] as const satisfies readonly PayrollComponentDef[]

export const DEDUCTION_COMPONENTS = [
  { key: "deductions", label: "Deductions", kind: "deduction" },
] as const satisfies readonly PayrollComponentDef[]

export const PAYROLL_COMPONENTS = [...EARNING_COMPONENTS, ...DEDUCTION_COMPONENTS] as const

export const PAYROLL_ELIGIBLE_STATUSES = ["active", "on_leave"] as const
