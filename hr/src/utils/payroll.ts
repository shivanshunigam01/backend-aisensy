import {
  PAYROLL_COMPONENTS,
  type PayrollComponentKey,
  type PayrollComponentKind,
} from "../constants/payroll.js"

export type SalaryAmounts = Record<PayrollComponentKey, number>

export type PayrollLine = {
  key: PayrollComponentKey
  label: string
  kind: PayrollComponentKind
  amount: number
}

export type PayrollComputation = {
  lines: PayrollLine[]
  earnings: PayrollLine[]
  deductions: PayrollLine[]
  grossSalary: number
  totalDeductions: number
  netSalary: number
}

export function roundMoney(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round((value + Number.EPSILON) * 100) / 100
}

function amountOf(amounts: Partial<SalaryAmounts>, key: PayrollComponentKey) {
  return roundMoney(Number(amounts[key] ?? 0))
}

export function computePayroll(amounts: Partial<SalaryAmounts>): PayrollComputation {
  const lines: PayrollLine[] = PAYROLL_COMPONENTS.map((component) => ({
    key: component.key,
    label: component.label,
    kind: component.kind,
    amount: amountOf(amounts, component.key),
  }))

  const earnings = lines.filter((line) => line.kind === "earning")
  const deductions = lines.filter((line) => line.kind === "deduction")
  const grossSalary = roundMoney(earnings.reduce((sum, line) => sum + line.amount, 0))
  const totalDeductions = roundMoney(deductions.reduce((sum, line) => sum + line.amount, 0))
  const netSalary = roundMoney(Math.max(0, grossSalary - totalDeductions))

  return {
    lines,
    earnings,
    deductions,
    grossSalary,
    totalDeductions,
    netSalary,
  }
}

export function lastDateKeyOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

export function periodLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}
