import crypto from "node:crypto"

import {
  AI_INTERVIEW_RESULT_LABELS,
  AI_INTERVIEW_STATUS_LABELS,
  DEFAULT_INTERVIEW_DURATION_MINUTES,
  DEFAULT_INTERVIEW_EXPIRY_HOURS,
  DEFAULT_PASSING_SCORE,
  type AiInterviewMode,
  type AiInterviewResult,
  type AiInterviewStatus,
} from "../constants/ai-interviews.js"
import { JOB_APPLICATION_STATUS_LABELS } from "../constants/job-applications.js"
import { MESSAGES } from "../constants/messages.js"
import { env } from "../config/env.js"
import { ApplicationModel } from "../models/application.model.js"
import { AIInterviewConfigModel } from "../models/ai-interview-config.model.js"
import { AIInterviewEvaluationModel } from "../models/ai-interview-evaluation.model.js"
import { AIInterviewModel } from "../models/ai-interview.model.js"
import { AIInterviewQuestionModel } from "../models/ai-interview-question.model.js"
import { CandidateModel } from "../models/candidate.model.js"
import { JobApplicationModel } from "../models/job-application.model.js"
import { JobModel } from "../models/job.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { logAiEvent } from "./ai/ai-provider.js"
import {
  calculateFinalScore,
  determineResult,
  evaluateAnswer,
  generateInterviewFeedback,
} from "./ai/interviewEvaluation.service.js"
import { generateInterviewQuestions } from "./ai/questionGeneration.service.js"
import { analyzeResumeAndJob } from "./ai/resumeAnalysis.service.js"
import {
  buildInterviewInvitationEmail,
  buildInterviewLink,
  sendEmail,
} from "./email.service.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { formatShortDate } from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { escapeRegex, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  AiInterviewListQueryInput,
  OverrideAiInterviewResultInput,
  SubmitAiInterviewAnswerInput,
  UpdateAiInterviewConfigInput,
} from "../validators/ai-interview.validators.js"

const POPULATE = [
  { path: "candidateId", select: "firstName lastName name email candidateNumber" },
] as const

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

function isoOf(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value) return new Date(value).toISOString()
  return ""
}

function stringsOf(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function toCandidateRef(value: unknown) {
  if (!value || typeof value !== "object") return null
  const candidate = value as {
    _id?: unknown
    name?: string
    firstName?: string
    lastName?: string
    email?: string
    candidateNumber?: string
  }
  const name =
    String(candidate.name ?? "").trim() ||
    `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim()
  return {
    id: String(candidate._id),
    name,
    email: candidate.email ?? "",
    candidateNumber: candidate.candidateNumber ?? "",
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex")
}

async function getOrgConfig(organizationId: string) {
  const config = await AIInterviewConfigModel.findOne({ organizationId }).lean()
  return {
    passingScore: config?.passingScore ?? env.AI_INTERVIEW_PASSING_SCORE ?? DEFAULT_PASSING_SCORE,
    interviewExpiryHours:
      config?.interviewExpiryHours ?? env.AI_INTERVIEW_EXPIRY_HOURS ?? DEFAULT_INTERVIEW_EXPIRY_HOURS,
    autoTriggerOnApply: config?.autoTriggerOnApply ?? true,
    interviewMode: (config?.interviewMode as AiInterviewMode | undefined) ?? "BOTH",
  }
}

function buildCandidateProfile(candidate: Record<string, unknown>) {
  const lines = [
    `Name: ${candidate.name ?? ""}`,
    `Email: ${candidate.email ?? ""}`,
    `Experience: ${candidate.totalExperience ?? candidate.experience ?? 0} years`,
    `Current Company: ${candidate.currentCompany ?? ""}`,
    `Current Designation: ${candidate.currentDesignation ?? ""}`,
    `Skills: ${stringsOf(candidate.skills).join(", ")}`,
    `Qualifications: ${stringsOf(candidate.qualifications).join(", ")}`,
    `Location: ${candidate.currentLocation ?? ""}`,
    `Resume: ${candidate.resumeFileName ?? candidate.resumeUrl ?? ""}`,
  ]
  return lines.filter(Boolean).join("\n")
}

function buildJobDescription(mandate: Record<string, unknown>) {
  const parts = [
    `Position: ${mandate.position ?? ""}`,
    `Department: ${mandate.department ?? ""}`,
    `Location: ${mandate.location ?? ""}`,
    `Responsibilities: ${stringsOf(mandate.responsibilities).join("; ")}`,
    `Critical Requirements: ${stringsOf(mandate.criticalRequirements).join("; ")}`,
    `Must Have Skills: ${stringsOf(mandate.mustHaveSkills ?? mandate.skills).join(", ")}`,
    `Preferred Skills: ${stringsOf(mandate.preferredSkills).join(", ")}`,
    `Qualifications: ${stringsOf(mandate.qualifications).join(", ")}`,
    `Special Instructions: ${mandate.specialInstructions ?? ""}`,
  ]
  return parts.filter(Boolean).join("\n")
}

function buildJobDescriptionFromJob(job: Record<string, unknown>) {
  return [
    `Title: ${job.title ?? ""}`,
    `Department: ${job.departmentName ?? ""}`,
    `Location: ${job.location ?? ""}`,
    `Description: ${job.description ?? ""}`,
    `Skills: ${stringsOf(job.skills).join(", ")}`,
  ].join("\n")
}

function getRequiredSkills(source: Record<string, unknown>) {
  const mustHave = stringsOf(source.mustHaveSkills ?? source.skills)
  const preferred = stringsOf(source.preferredSkills)
  return [...new Set([...mustHave, ...preferred])]
}

function toPublicQuestion(doc: Record<string, unknown>, includeAnswer = false) {
  const base = {
    id: String(doc._id ?? doc.id),
    order: Number(doc.order ?? 0),
    question: String(doc.question ?? ""),
    category: String(doc.category ?? "TECHNICAL"),
    difficulty: String(doc.difficulty ?? "MEDIUM"),
    submittedAt: isoOf(doc.submittedAt),
  }

  if (!includeAnswer) return base

  return {
    ...base,
    candidateAnswer: String(doc.candidateAnswer ?? ""),
    score: doc.score != null ? Number(doc.score) : null,
    feedback: String(doc.feedback ?? ""),
    evaluation: doc.evaluation ?? {},
  }
}

function effectiveResult(doc: Record<string, unknown>): AiInterviewResult {
  const overridden = String(doc.overriddenResult ?? "").trim()
  if (overridden === "PASSED" || overridden === "FAILED") {
    return overridden
  }
  return (doc.result as AiInterviewResult) ?? "PENDING"
}

export function toPublicAiInterview(
  doc: Record<string, unknown>,
  extras?: {
    questions?: Record<string, unknown>[]
    evaluation?: Record<string, unknown> | null
    jobTitle?: string
    companyName?: string
    includeAnswers?: boolean
  }
) {
  const result = effectiveResult(doc)
  const candidate = toCandidateRef(doc.candidateId)

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    applicationId: asId(doc.applicationId),
    applicationType: String(doc.applicationType ?? "JOB_APPLICATION"),
    candidateId: asId(doc.candidateId),
    candidate,
    jobId: asId(doc.jobId),
    jobType: String(doc.jobType ?? "MANDATE"),
    jobTitle: extras?.jobTitle ?? "",
    companyName: extras?.companyName ?? "",
    status: String(doc.status ?? "SCHEDULED") as AiInterviewStatus,
    statusLabel: AI_INTERVIEW_STATUS_LABELS[String(doc.status) as AiInterviewStatus] ?? String(doc.status),
    result,
    resultLabel: AI_INTERVIEW_RESULT_LABELS[result] ?? result,
    overriddenResult: String(doc.overriddenResult ?? ""),
    overrideReason: String(doc.overrideReason ?? ""),
    finalScore: doc.finalScore != null ? Number(doc.finalScore) : null,
    passingScoreUsed: Number(doc.passingScoreUsed ?? DEFAULT_PASSING_SCORE),
    resumeAnalysis: doc.resumeAnalysis ?? {},
    startedAt: isoOf(doc.startedAt),
    completedAt: isoOf(doc.completedAt),
    expiresAt: isoOf(doc.expiresAt),
    invitationSentAt: isoOf(doc.invitationSentAt),
    interviewLink: doc.uniqueToken ? buildInterviewLink(String(doc.uniqueToken)) : "",
    questions: (extras?.questions ?? []).map((q) => toPublicQuestion(q, extras?.includeAnswers)),
    evaluation: extras?.evaluation ?? null,
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function resolveJobContext(
  jobType: string,
  jobId: string,
  organizationId: string
) {
  if (jobType === "JOB") {
    const job = await JobModel.findOne({ _id: jobId, organizationId }).lean()
    if (!job) throw AppError.notFound("Job not found")
    const org = await OrganizationModel.findById(organizationId).select("name").lean()
    return {
      jobTitle: String(job.title ?? ""),
      companyName: String(org?.name ?? ""),
      jobDescription: buildJobDescriptionFromJob(job as Record<string, unknown>),
      requiredSkills: stringsOf(job.skills),
    }
  }

  const mandate = await RecruitmentMandateModel.findOne({ _id: jobId, organizationId })
    .populate([{ path: "clientId", select: "companyName" }])
    .lean()
  if (!mandate) throw AppError.notFound("Job mandate not found")

  const client =
    mandate.clientId && typeof mandate.clientId === "object" && "companyName" in mandate.clientId
      ? (mandate.clientId as { companyName?: string })
      : null

  return {
    jobTitle: String(mandate.position ?? ""),
    companyName: client?.companyName ?? "",
    jobDescription: buildJobDescription(mandate as Record<string, unknown>),
    requiredSkills: getRequiredSkills(mandate as Record<string, unknown>),
  }
}

async function sendInvitation(
  interview: Record<string, unknown>,
  candidate: Record<string, unknown>,
  jobTitle: string,
  companyName: string
) {
  const token = String(interview.uniqueToken ?? "")
  const expiresAt = interview.expiresAt instanceof Date ? interview.expiresAt : new Date(String(interview.expiresAt))
  const emailContent = buildInterviewInvitationEmail({
    candidateName: String(candidate.name ?? "Candidate"),
    jobTitle,
    companyName,
    interviewLink: buildInterviewLink(token),
    expiryDate: formatShortDate(expiresAt.toISOString().slice(0, 10)),
    durationMinutes: DEFAULT_INTERVIEW_DURATION_MINUTES,
  })

  await sendEmail({
    to: String(candidate.email ?? ""),
    subject: emailContent.subject,
    text: emailContent.text,
  })

  await AIInterviewModel.updateOne(
    { _id: interview._id ?? interview.id },
    { $set: { invitationSentAt: new Date() } }
  )
}

export async function createAiInterviewForApplication(input: {
  organizationId: string
  applicationId: string
  applicationType: "JOB_APPLICATION" | "APPLICATION"
  candidateId: string
  jobId: string
  jobType: "MANDATE" | "JOB"
}) {
  const existing = await AIInterviewModel.findOne({
    organizationId: input.organizationId,
    applicationId: input.applicationId,
    status: { $nin: ["CANCELLED", "EXPIRED"] },
  }).lean()

  if (existing) {
    logAiEvent("interview_already_exists", { applicationId: input.applicationId })
    return existing
  }

  const config = await getOrgConfig(input.organizationId)
  const candidate = await CandidateModel.findOne({
    _id: input.candidateId,
    organizationId: input.organizationId,
  }).lean()
  if (!candidate) throw AppError.notFound(MESSAGES.CANDIDATE_NOT_FOUND)

  const jobContext = await resolveJobContext(input.jobType, input.jobId, input.organizationId)
  const candidateProfile = buildCandidateProfile(candidate as Record<string, unknown>)

  const resumeAnalysis = await analyzeResumeAndJob({
    candidateName: String(candidate.name ?? ""),
    candidateProfile,
    jobTitle: jobContext.jobTitle,
    jobDescription: jobContext.jobDescription,
    requiredSkills: jobContext.requiredSkills,
  })

  const questions = await generateInterviewQuestions({
    candidateName: String(candidate.name ?? ""),
    candidateProfile,
    jobTitle: jobContext.jobTitle,
    jobDescription: jobContext.jobDescription,
    requiredSkills: jobContext.requiredSkills,
    resumeAnalysis,
  })

  const expiresAt = new Date(Date.now() + config.interviewExpiryHours * 60 * 60 * 1000)
  const token = generateToken()

  const interview = await AIInterviewModel.create({
    organizationId: input.organizationId,
    applicationId: input.applicationId,
    applicationType: input.applicationType,
    candidateId: input.candidateId,
    jobId: input.jobId,
    jobType: input.jobType,
    uniqueToken: token,
    resumeAnalysis: { ...resumeAnalysis, rawAnalysis: resumeAnalysis },
    status: "SCHEDULED",
    expiresAt,
    passingScoreUsed: config.passingScore,
    result: "PENDING",
  })

  await AIInterviewQuestionModel.insertMany(
    questions.map((q) => ({
      organizationId: input.organizationId,
      interviewId: interview._id,
      order: q.order,
      question: q.question,
      category: q.category,
      difficulty: q.difficulty,
    }))
  )

  if (input.applicationType === "JOB_APPLICATION") {
    await JobApplicationModel.updateOne(
      { _id: input.applicationId },
      { $set: { status: "AI_INTERVIEW_PENDING" } }
    )
  }

  await sendInvitation(
    interview.toObject() as Record<string, unknown>,
    candidate as Record<string, unknown>,
    jobContext.jobTitle,
    jobContext.companyName
  )

  await recordActivity(input.organizationId, {
    title: "AI interview created",
    detail: `${candidate.name} · ${jobContext.jobTitle}`,
    tone: "brand",
  })

  logAiEvent("interview_created", {
    interviewId: String(interview._id),
    applicationId: input.applicationId,
    candidateId: input.candidateId,
  })

  return interview.toObject()
}

export async function triggerAiInterviewWorkflow(input: {
  organizationId: string
  applicationId: string
  applicationType: "JOB_APPLICATION" | "APPLICATION"
  candidateId: string
  jobId: string
  jobType: "MANDATE" | "JOB"
}) {
  const config = await getOrgConfig(input.organizationId)
  if (!config.autoTriggerOnApply) return null

  if (input.applicationType === "JOB_APPLICATION") {
    await JobApplicationModel.updateOne(
      { _id: input.applicationId },
      { $set: { status: "RESUME_SCREENING" } }
    )
  }

  return createAiInterviewForApplication(input)
}

async function loadInterviewByToken(token: string) {
  const interview = await AIInterviewModel.findOne({ uniqueToken: token })
    .populate([...POPULATE])
    .lean()
  if (!interview) throw AppError.notFound("Interview not found")

  if (interview.expiresAt && new Date(interview.expiresAt) < new Date()) {
    if (interview.status !== "COMPLETED") {
      await AIInterviewModel.updateOne({ _id: interview._id }, { $set: { status: "EXPIRED" } })
    }
    throw AppError.badRequest("This interview link has expired")
  }

  return interview
}

export async function getAiInterviewByToken(token: string) {
  const interview = await loadInterviewByToken(token)
  const questions = await AIInterviewQuestionModel.find({ interviewId: interview._id })
    .sort({ order: 1 })
    .lean()

  const jobContext = await resolveJobContext(
    String(interview.jobType),
    asId(interview.jobId),
    asId(interview.organizationId)
  )

  const isCompleted = interview.status === "COMPLETED"
  const currentQuestion = questions.find((q) => !q.submittedAt)
  const orgConfig = await getOrgConfig(asId(interview.organizationId))

  return {
    interview: toPublicAiInterview(interview as Record<string, unknown>, {
      jobTitle: jobContext.jobTitle,
      companyName: jobContext.companyName,
      questions: questions.map((q) => {
        const publicQ = toPublicQuestion(q as Record<string, unknown>, isCompleted)
        if (!isCompleted && q.submittedAt) {
          return { ...publicQ, candidateAnswer: String(q.candidateAnswer ?? "") }
        }
        if (!isCompleted && !q.submittedAt) {
          return { ...publicQ, candidateAnswer: "" }
        }
        return publicQ
      }),
    }),
    currentQuestionOrder: currentQuestion?.order ?? null,
    totalQuestions: questions.length,
    isCompleted,
    interviewMode: orgConfig.interviewMode,
  }
}

export async function startAiInterview(token: string) {
  const interview = await loadInterviewByToken(token)

  if (interview.status === "COMPLETED") {
    throw AppError.conflict("Interview already completed")
  }

  if (interview.status === "CANCELLED") {
    throw AppError.badRequest("Interview has been cancelled")
  }

  const update: Record<string, unknown> = { status: "IN_PROGRESS" }
  if (!interview.startedAt) {
    update.startedAt = new Date()
  }

  await AIInterviewModel.updateOne({ _id: interview._id }, { $set: update })

  logAiEvent("interview_started", { interviewId: String(interview._id) })

  return getAiInterviewByToken(token)
}

export async function submitAiInterviewAnswer(token: string, input: SubmitAiInterviewAnswerInput) {
  const interview = await loadInterviewByToken(token)

  if (interview.status === "COMPLETED") {
    throw AppError.conflict("Interview already completed")
  }

  if (interview.status === "SCHEDULED") {
    await AIInterviewModel.updateOne(
      { _id: interview._id },
      { $set: { status: "IN_PROGRESS", startedAt: interview.startedAt ?? new Date() } }
    )
  }

  const question = await AIInterviewQuestionModel.findOne({
    interviewId: interview._id,
    order: input.questionOrder,
  }).lean()

  if (!question) throw AppError.notFound("Question not found")
  if (question.submittedAt) {
    throw AppError.conflict("This question has already been answered")
  }

  await AIInterviewQuestionModel.updateOne(
    { _id: question._id },
    {
      $set: {
        candidateAnswer: input.answer.trim(),
        answerMode: input.answerMode ?? "TEXT",
        submittedAt: new Date(),
      },
    }
  )

  logAiEvent("answer_submitted", {
    interviewId: String(interview._id),
    questionOrder: input.questionOrder,
  })

  const remaining = await AIInterviewQuestionModel.countDocuments({
    interviewId: interview._id,
    submittedAt: null,
  })

  if (remaining === 0) {
    return completeAiInterviewByToken(token)
  }

  return getAiInterviewByToken(token)
}

async function completeAiInterviewByToken(token: string) {
  const interview = await loadInterviewByToken(token)
  const questions = await AIInterviewQuestionModel.find({ interviewId: interview._id })
    .sort({ order: 1 })
    .lean()

  const jobContext = await resolveJobContext(
    String(interview.jobType),
    asId(interview.jobId),
    asId(interview.organizationId)
  )

  const candidate = await CandidateModel.findById(interview.candidateId).select("name").lean()
  const passingScore = Number(interview.passingScoreUsed ?? DEFAULT_PASSING_SCORE)
  const questionScores: number[] = []

  for (const question of questions) {
    const evaluation = await evaluateAnswer({
      question: String(question.question),
      category: String(question.category),
      candidateAnswer: String(question.candidateAnswer ?? ""),
      jobTitle: jobContext.jobTitle,
      requiredSkills: jobContext.requiredSkills,
    })

    questionScores.push(evaluation.questionScore)

    await AIInterviewQuestionModel.updateOne(
      { _id: question._id },
      {
        $set: {
          score: evaluation.questionScore,
          feedback: evaluation.feedback,
          evaluation: {
            technicalAccuracy: evaluation.technicalAccuracy,
            communication: evaluation.communication,
            problemSolving: evaluation.problemSolving,
            relevance: evaluation.relevance,
          },
        },
      }
    )
  }

  const finalScore = calculateFinalScore(questionScores)
  const result = determineResult(finalScore, passingScore)

  const questionEvaluations = questions.map((q, i) => ({
    question: String(q.question),
    score: questionScores[i] ?? 0,
    feedback: "",
  }))

  const updatedQuestions = await AIInterviewQuestionModel.find({ interviewId: interview._id })
    .sort({ order: 1 })
    .lean()

  for (let i = 0; i < updatedQuestions.length; i++) {
    const evaluation = questionEvaluations[i]
    if (evaluation) {
      evaluation.feedback = String(updatedQuestions[i]?.feedback ?? "")
    }
  }

  const finalFeedback = await generateInterviewFeedback({
    candidateName: String(candidate?.name ?? "Candidate"),
    jobTitle: jobContext.jobTitle,
    questionEvaluations,
    finalScore,
  })

  await AIInterviewEvaluationModel.findOneAndUpdate(
    { interviewId: interview._id },
    {
      organizationId: interview.organizationId,
      interviewId: interview._id,
      technicalScore: finalFeedback.technicalScore,
      communicationScore: finalFeedback.communicationScore,
      problemSolvingScore: finalFeedback.problemSolvingScore,
      relevanceScore: finalFeedback.relevanceScore,
      finalScore,
      result,
      overallFeedback: finalFeedback.overallFeedback,
      strengths: finalFeedback.strengths,
      weaknesses: finalFeedback.weaknesses,
      recommendation: finalFeedback.recommendation,
      rawEvaluation: finalFeedback,
    },
    { upsert: true, new: true }
  )

  await AIInterviewModel.updateOne(
    { _id: interview._id },
    {
      $set: {
        status: "COMPLETED",
        completedAt: new Date(),
        finalScore,
        result,
      },
    }
  )

  const applicationStatus = result === "PASSED" ? "AI_INTERVIEW_PASSED" : "AI_INTERVIEW_FAILED"

  if (interview.applicationType === "JOB_APPLICATION") {
    await JobApplicationModel.updateOne(
      { _id: interview.applicationId },
      { $set: { status: applicationStatus } }
    )
  } else if (interview.applicationType === "APPLICATION") {
    const stage = result === "PASSED" ? "screening" : "rejected"
    await ApplicationModel.updateOne({ _id: interview.applicationId }, { $set: { stage } })
  }

  await recordActivity(asId(interview.organizationId), {
    title: `AI interview ${result === "PASSED" ? "passed" : "failed"}`,
    detail: `${candidate?.name ?? "Candidate"} · ${jobContext.jobTitle} · ${finalScore}%`,
    tone: result === "PASSED" ? "success" : "warning",
  })

  logAiEvent("interview_completed", {
    interviewId: String(interview._id),
    finalScore,
    result,
  })

  return getAiInterviewByToken(token)
}

export async function completeAiInterview(token: string) {
  const interview = await loadInterviewByToken(token)

  if (interview.status === "COMPLETED") {
    return getAiInterviewByToken(token)
  }

  const unanswered = await AIInterviewQuestionModel.countDocuments({
    interviewId: interview._id,
    submittedAt: null,
  })

  if (unanswered > 0) {
    throw AppError.badRequest("All questions must be answered before completing the interview")
  }

  return completeAiInterviewByToken(token)
}

export async function listAiInterviews(auth: AuthContext, query: AiInterviewListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.status) filter.status = query.status
  if (query.result) filter.result = query.result
  if (query.candidateId) filter.candidateId = parseObjectId(query.candidateId, "Candidate")
  if (query.jobId) filter.jobId = parseObjectId(query.jobId, "Job")

  const search = resolvedSearch(query.search)
  if (search) {
    const candidates = await CandidateModel.find({
      organizationId: auth.organizationId,
      $or: [
        { name: new RegExp(escapeRegex(search), "i") },
        { email: new RegExp(escapeRegex(search), "i") },
      ],
    })
      .select("_id")
      .lean()
    filter.candidateId = { $in: candidates.map((c) => c._id) }
  }

  const sort = mongoSort(query, { createdAt: -1 })
  const skip = paginationSkip(query)

  const [items, total] = await Promise.all([
    AIInterviewModel.find(filter).populate([...POPULATE]).sort(sort).skip(skip).limit(query.limit).lean(),
    AIInterviewModel.countDocuments(filter),
  ])

  const enriched = await Promise.all(
    items.map(async (item) => {
      const jobContext = await resolveJobContext(
        String(item.jobType),
        asId(item.jobId),
        auth.organizationId
      )
      return toPublicAiInterview(item as Record<string, unknown>, {
        jobTitle: jobContext.jobTitle,
        companyName: jobContext.companyName,
      })
    })
  )

  return { items: enriched, ...paginationMeta(total, query) }
}

export async function getAiInterview(auth: AuthContext, id: string) {
  const interviewId = parseObjectId(id, "Interview")
  const interview = await AIInterviewModel.findOne({
    _id: interviewId,
    organizationId: auth.organizationId,
  })
    .populate([...POPULATE])
    .lean()

  if (!interview) throw AppError.notFound("AI interview not found")

  const [questions, evaluation] = await Promise.all([
    AIInterviewQuestionModel.find({ interviewId: interview._id }).sort({ order: 1 }).lean(),
    AIInterviewEvaluationModel.findOne({ interviewId: interview._id }).lean(),
  ])

  const jobContext = await resolveJobContext(
    String(interview.jobType),
    asId(interview.jobId),
    auth.organizationId
  )

  return toPublicAiInterview(interview as Record<string, unknown>, {
    jobTitle: jobContext.jobTitle,
    companyName: jobContext.companyName,
    questions: questions as Record<string, unknown>[],
    evaluation,
    includeAnswers: true,
  })
}

export async function createAiInterviewForApplicationId(auth: AuthContext, applicationId: string) {
  const appId = parseObjectId(applicationId, "Application")
  const application = await JobApplicationModel.findOne({
    _id: appId,
    organizationId: auth.organizationId,
  }).lean()

  if (!application) throw AppError.notFound("Application not found")

  const interview = await createAiInterviewForApplication({
    organizationId: auth.organizationId,
    applicationId: String(application._id),
    applicationType: "JOB_APPLICATION",
    candidateId: asId(application.candidateId),
    jobId: asId(application.mandateId),
    jobType: "MANDATE",
  })

  return getAiInterview(auth, String(interview._id ?? (interview as { id?: string }).id))
}

export async function resendAiInterviewInvitation(auth: AuthContext, id: string) {
  const interview = await getAiInterview(auth, id)
  const candidate = await CandidateModel.findById(interview.candidateId).lean()
  if (!candidate) throw AppError.notFound(MESSAGES.CANDIDATE_NOT_FOUND)

  const doc = await AIInterviewModel.findById(interview.id).lean()
  if (!doc) throw AppError.notFound("AI interview not found")

  await sendInvitation(
    doc as Record<string, unknown>,
    candidate as Record<string, unknown>,
    interview.jobTitle,
    interview.companyName
  )

  return getAiInterview(auth, id)
}

export async function regenerateAiInterviewLink(auth: AuthContext, id: string) {
  const interviewId = parseObjectId(id, "Interview")
  const interview = await AIInterviewModel.findOne({
    _id: interviewId,
    organizationId: auth.organizationId,
  }).lean()

  if (!interview) throw AppError.notFound("AI interview not found")
  if (interview.status === "COMPLETED") {
    throw AppError.conflict("Cannot regenerate link for completed interview")
  }

  const config = await getOrgConfig(auth.organizationId)
  const newToken = generateToken()
  const expiresAt = new Date(Date.now() + config.interviewExpiryHours * 60 * 60 * 1000)

  await AIInterviewModel.updateOne(
    { _id: interview._id },
    {
      $set: {
        uniqueToken: newToken,
        expiresAt,
        status: interview.status === "EXPIRED" ? "SCHEDULED" : interview.status,
      },
    }
  )

  await recordAudit(auth, {
    module: "INTERVIEWS",
    action: "GENERATED",
    recordId: String(interview._id),
    newData: { uniqueToken: newToken, expiresAt: expiresAt.toISOString() },
  })

  return getAiInterview(auth, id)
}

export async function overrideAiInterviewResult(
  auth: AuthContext,
  id: string,
  input: OverrideAiInterviewResultInput
) {
  const interviewId = parseObjectId(id, "Interview")
  const interview = await AIInterviewModel.findOne({
    _id: interviewId,
    organizationId: auth.organizationId,
  }).lean()

  if (!interview) throw AppError.notFound("AI interview not found")

  await AIInterviewModel.updateOne(
    { _id: interview._id },
    {
      $set: {
        overriddenResult: input.result,
        overrideReason: input.reason ?? "",
        overriddenBy: auth.userId,
        overriddenAt: new Date(),
      },
    }
  )

  const applicationStatus =
    input.result === "PASSED" ? "AI_INTERVIEW_PASSED" : "AI_INTERVIEW_FAILED"

  if (interview.applicationType === "JOB_APPLICATION") {
    await JobApplicationModel.updateOne(
      { _id: interview.applicationId },
      { $set: { status: applicationStatus } }
    )
  }

  await AIInterviewEvaluationModel.updateOne(
    { interviewId: interview._id },
    { $set: { result: input.result } }
  )

  await recordAudit(auth, {
    module: "INTERVIEWS",
    action: "OVERRIDE",
    recordId: String(interview._id),
    newData: { result: input.result, reason: input.reason },
  })

  return getAiInterview(auth, id)
}

export async function getAiInterviewConfig(auth: AuthContext) {
  const config = await getOrgConfig(auth.organizationId)
  return config
}

export async function updateAiInterviewConfig(auth: AuthContext, input: UpdateAiInterviewConfigInput) {
  const config = await AIInterviewConfigModel.findOneAndUpdate(
    { organizationId: auth.organizationId },
    {
      $set: {
        ...(input.passingScore !== undefined ? { passingScore: input.passingScore } : {}),
        ...(input.interviewExpiryHours !== undefined
          ? { interviewExpiryHours: input.interviewExpiryHours }
          : {}),
        ...(input.autoTriggerOnApply !== undefined
          ? { autoTriggerOnApply: input.autoTriggerOnApply }
          : {}),
        ...(input.interviewMode !== undefined ? { interviewMode: input.interviewMode } : {}),
      },
    },
    { upsert: true, new: true }
  ).lean()

  await recordAudit(auth, {
    module: "INTERVIEWS",
    action: "UPDATED",
    recordId: String(config?._id ?? auth.organizationId),
    newData: input,
  })

  return {
    passingScore: config?.passingScore ?? DEFAULT_PASSING_SCORE,
    interviewExpiryHours: config?.interviewExpiryHours ?? DEFAULT_INTERVIEW_EXPIRY_HOURS,
    autoTriggerOnApply: config?.autoTriggerOnApply ?? true,
    interviewMode: (config?.interviewMode as AiInterviewMode | undefined) ?? "BOTH",
  }
}

export { JOB_APPLICATION_STATUS_LABELS }
