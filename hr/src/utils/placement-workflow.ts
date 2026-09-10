import { CandidateConsentModel } from "../models/candidate-consent.model.js"
import { CandidateEvaluationModel } from "../models/candidate-evaluation.model.js"
import { ClientAgreementModel } from "../models/client-agreement.model.js"
import { ClientModel } from "../models/client.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { MESSAGES } from "../constants/messages.js"
import { isMandateOpenForSourcing } from "../constants/mandates.js"
import {
  DEFAULT_DUPLICATE_NOTIFICATION_DAYS,
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_OWNERSHIP_PERIOD_MONTHS,
  DEFAULT_PAYMENT_TERMS_DAYS,
  DEFAULT_REPLACEMENT_PERIOD_DAYS,
} from "../constants/agreements.js"
import { AppError } from "./app-error.js"
import { parseObjectId } from "./object-id.js"

export type PlacementCommercialTerms = {
  agreementId: string
  recruitmentFee: number
  feeType: string
  paymentTermsDays: number
  gstRatePercent: number
  gstSplitMode: string
  ownershipPeriodMonths: number
  duplicateNotificationDays: number
  replacementPeriodDays: number
}

/**
 * Enforce starter-kit gates before a candidate can be submitted to a client.
 * Draft submissions may skip these; introduced statuses must pass.
 */
export async function assertSubmissionWorkflowReady(input: {
  organizationId: string
  candidateId: string
  mandateId: string
  clientId: string
  evaluationId?: string | null
  requireEvaluation?: boolean
}) {
  parseObjectId(input.clientId, "Invalid client")
  parseObjectId(input.candidateId, "Invalid candidate")
  parseObjectId(input.mandateId, "Invalid mandate")

  const client = await ClientModel.findOne({
    _id: input.clientId,
    organizationId: input.organizationId,
  }).select("_id status companyName")

  if (!client) {
    throw AppError.badRequest(MESSAGES.CLIENT_NOT_IN_ORGANIZATION)
  }
  if (String(client.status) !== "ACTIVE") {
    throw AppError.badRequest(MESSAGES.SUBMISSION_CLIENT_INACTIVE)
  }

  const mandate = await RecruitmentMandateModel.findOne({
    _id: input.mandateId,
    organizationId: input.organizationId,
  }).select(
    "_id status clientId agreementId recruitmentFee feeType replacementPeriodDays paymentTermsDays"
  )

  if (!mandate) {
    throw AppError.badRequest(MESSAGES.MANDATE_NOT_IN_ORGANIZATION)
  }
  if (String(mandate.clientId) !== String(client._id)) {
    throw AppError.badRequest(MESSAGES.MANDATE_CLIENT_MISMATCH)
  }
  if (!isMandateOpenForSourcing(String(mandate.status))) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_MANDATE_NOT_APPROVED)
  }

  if (!mandate.agreementId) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_AGREEMENT_INACTIVE)
  }

  const agreement = await ClientAgreementModel.findOne({
    _id: mandate.agreementId,
    organizationId: input.organizationId,
  }).select(
    "_id status commercialTerms ownershipPeriodMonths duplicateNotificationDays replacementPeriodDays clientId expiryDate"
  )

  if (!agreement) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_AGREEMENT_INACTIVE)
  }
  if (String(agreement.clientId) !== String(client._id)) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_AGREEMENT_INACTIVE)
  }

  let agreementStatus = String(agreement.status)
  if (
    agreementStatus === "ACTIVE" &&
    agreement.expiryDate &&
    new Date(agreement.expiryDate).getTime() < Date.now()
  ) {
    agreementStatus = "EXPIRED"
  }
  if (agreementStatus !== "ACTIVE") {
    throw AppError.badRequest(MESSAGES.SUBMISSION_AGREEMENT_INACTIVE)
  }

  const consent = await CandidateConsentModel.findOne({
    organizationId: input.organizationId,
    candidateId: input.candidateId,
    mandateId: input.mandateId,
    consentGiven: true,
    $or: [{ withdrawnAt: null }, { withdrawnAt: { $exists: false } }],
  }).select("_id")

  if (!consent) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_CONSENT_REQUIRED)
  }

  let evaluation = null as Awaited<ReturnType<typeof CandidateEvaluationModel.findOne>> | null
  if (input.evaluationId) {
    evaluation = await CandidateEvaluationModel.findOne({
      _id: input.evaluationId,
      organizationId: input.organizationId,
    }).select("_id candidateId mandateId totalScore recommendation scoringVersion")
    if (!evaluation) {
      throw AppError.badRequest(MESSAGES.EVALUATION_NOT_FOUND)
    }
    if (String(evaluation.candidateId) !== String(input.candidateId)) {
      throw AppError.badRequest(MESSAGES.EVALUATION_CANDIDATE_MISMATCH)
    }
    if (String(evaluation.mandateId) !== String(input.mandateId)) {
      throw AppError.badRequest(MESSAGES.EVALUATION_MANDATE_MISMATCH)
    }
  } else if (input.requireEvaluation !== false) {
    evaluation = await CandidateEvaluationModel.findOne({
      organizationId: input.organizationId,
      candidateId: input.candidateId,
      mandateId: input.mandateId,
    })
      .sort({ evaluatedAt: -1, createdAt: -1 })
      .select("_id candidateId mandateId totalScore recommendation scoringVersion")
    if (!evaluation) {
      throw AppError.badRequest(MESSAGES.SUBMISSION_EVALUATION_REQUIRED)
    }
  }

  const commercial: PlacementCommercialTerms = {
    agreementId: String(agreement._id),
    recruitmentFee: Number(
      mandate.recruitmentFee ?? agreement.commercialTerms?.recruitmentFee ?? 0
    ),
    feeType: String(mandate.feeType ?? agreement.commercialTerms?.feeType ?? "PERCENTAGE"),
    paymentTermsDays: Number(
      mandate.paymentTermsDays ??
        agreement.commercialTerms?.paymentTermsDays ??
        DEFAULT_PAYMENT_TERMS_DAYS
    ),
    gstRatePercent: Number(
      agreement.commercialTerms?.gstRatePercent ?? DEFAULT_GST_RATE_PERCENT
    ),
    gstSplitMode: String(agreement.commercialTerms?.gstSplitMode ?? "CGST_SGST"),
    ownershipPeriodMonths: Number(
      agreement.ownershipPeriodMonths ?? DEFAULT_OWNERSHIP_PERIOD_MONTHS
    ),
    duplicateNotificationDays: Number(
      agreement.duplicateNotificationDays ?? DEFAULT_DUPLICATE_NOTIFICATION_DAYS
    ),
    replacementPeriodDays: Number(
      mandate.replacementPeriodDays ??
        agreement.replacementPeriodDays ??
        DEFAULT_REPLACEMENT_PERIOD_DAYS
    ),
  }

  return { client, mandate, agreement, consent, evaluation, commercial }
}
