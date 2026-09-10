import { EMPLOYMENT_TYPES } from "../constants/employees.js"
import { JobModel } from "../models/job.model.js"

type MandateLike = {
  _id: unknown
  organizationId: unknown
  mandateNumber?: string
  position: string
  department?: string
  employmentType: (typeof EMPLOYMENT_TYPES)[number]
  vacancies?: number
  location?: string
  workMode?: string
  reportingTo?: string
  experience?: { minimum?: number; maximum?: number } | null
  salary?: { minimum?: number; maximum?: number; currency?: string } | null
  qualifications?: string[]
  skills?: string[]
  responsibilities?: string[]
  criticalRequirements?: string[]
  interviewProcess?: string[]
  status: string
}

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

function lines(items?: string[]) {
  return (items ?? []).map((item) => String(item).trim()).filter(Boolean)
}

function section(title: string, items?: string[]) {
  const body = lines(items)
  if (!body.length) return ""
  return `${title}\n${body.map((item) => `• ${item}`).join("\n")}`
}

export function jobStatusForMandate(status: string) {
  if (status === "OPEN") return "open" as const
  if (status === "ON_HOLD" || status === "DRAFT") return "paused" as const
  return "closed" as const
}

export function descriptionFromMandate(mandate: MandateLike) {
  const experience = mandate.experience ?? {}
  const salary = mandate.salary ?? {}
  const meta: string[] = []

  if (mandate.workMode) meta.push(`Work mode: ${mandate.workMode}`)
  if (mandate.reportingTo) meta.push(`Reports to: ${mandate.reportingTo}`)
  if (Number(experience.minimum) || Number(experience.maximum)) {
    meta.push(`Experience: ${Number(experience.minimum ?? 0)}–${Number(experience.maximum ?? 0)} years`)
  }
  if (Number(salary.minimum) || Number(salary.maximum)) {
    const currency = String(salary.currency ?? "INR")
    meta.push(`Salary: ${currency} ${Number(salary.minimum ?? 0)}–${Number(salary.maximum ?? 0)}`)
  }
  if (mandate.vacancies) meta.push(`Openings: ${mandate.vacancies}`)

  const parts = [
    meta.join("\n"),
    section("Responsibilities", mandate.responsibilities),
    section("Skills", mandate.skills),
    section("Qualifications", mandate.qualifications),
    section("Critical requirements", mandate.criticalRequirements),
    section("Interview process", mandate.interviewProcess),
  ].filter(Boolean)

  return parts.join("\n\n").slice(0, 8000)
}

export async function syncJobForMandate(mandate: MandateLike) {
  const organizationId = asId(mandate.organizationId)
  const mandateId = asId(mandate._id)
  const payload = {
    title: mandate.position,
    location: mandate.location ?? "",
    employmentType: mandate.employmentType,
    description: descriptionFromMandate(mandate),
    status: jobStatusForMandate(mandate.status),
    departmentName: mandate.department ?? "",
    workMode: mandate.workMode ?? "",
    skills: lines(mandate.skills).slice(0, 20),
    experienceMinimum: Number(mandate.experience?.minimum ?? 0),
    experienceMaximum: Number(mandate.experience?.maximum ?? 0),
    vacancies: Number(mandate.vacancies ?? 1) || 1,
  }

  const existing = await JobModel.findOne({
    organizationId,
    mandateId,
  })

  if (existing) {
    existing.set(payload)
    await existing.save()
    return existing
  }

  if (mandate.status !== "OPEN") {
    return null
  }

  return JobModel.create({
    organizationId,
    mandateId,
    ...payload,
  })
}

export async function closeJobForMandate(organizationId: string, mandateId: string) {
  await JobModel.updateOne(
    { organizationId, mandateId },
    { $set: { status: "closed" } }
  )
}

export async function findJobsByMandateIds(organizationId: string, mandateIds: unknown[]) {
  const ids = mandateIds.map(asId).filter(Boolean)
  if (!ids.length) return new Map<string, { id: string; status: string }>()

  const jobs = await JobModel.find({
    organizationId,
    mandateId: { $in: ids },
  })
    .select("_id mandateId status")
    .lean()

  return new Map(
    jobs.map((job) => [
      String(job.mandateId),
      { id: String(job._id), status: String(job.status ?? "") },
    ])
  )
}
