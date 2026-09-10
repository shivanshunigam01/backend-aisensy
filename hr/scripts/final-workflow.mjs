import { randomUUID } from "node:crypto"

const stamp = randomUUID().replaceAll("-", "")
const BASE = process.env.API_BASE ?? "http://127.0.0.1:4025/api/v1"
const EMAIL = `workflow.${stamp}@example.com`
const PASSWORD = "WorkflowTest1"
const TODAY = new Date().toISOString().slice(0, 10)
const JOINING = TODAY
const RESULTS = []

function fail(step, detail) {
  console.error(`FAIL ${step}: ${detail}`)
  process.exit(1)
}

function pass(step, extra = "") {
  const line = extra ? `${step} — ${extra}` : step
  RESULTS.push(line)
  console.log(`PASS ${line}`)
}

async function request(method, path, { token, body, expected } = {}) {
  const headers = { Accept: "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers["Content-Type"] = "application/json"
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  const ok = expected ? expected.includes(res.status) : res.status >= 200 && res.status < 300
  if (!ok) {
    fail(`${method} ${path}`, `${res.status} ${JSON.stringify(json)}`)
  }
  return json
}

function idOf(payload, key) {
  const record = key ? payload?.data?.[key] : payload?.data
  const id = record?.id ?? record?._id
  if (!id) fail("parse id", JSON.stringify(payload))
  return id
}

const health = await request("GET", "/health")
if (!health.success || health.data?.database !== "connected") {
  fail("0. Health", JSON.stringify(health))
}

const registered = await request("POST", "/auth/register", {
  body: {
    name: "Workflow Admin",
    email: EMAIL,
    password: PASSWORD,
    organizationName: `Workflow Org ${stamp}`,
    employeeId: `WF-${stamp.slice(0, 12)}`,
  },
  expected: [201],
})
const token = registered.data.accessToken
const userId = registered.data.user.id
pass("0. Register org admin", EMAIL)

const clientCreated = await request("POST", "/clients", {
  token,
  body: {
    companyName: "Northwind Hiring Ltd",
    legalEntityName: "Northwind Hiring Private Limited",
    industry: "IT services",
    city: "Bengaluru",
    status: "LEAD",
    onboardingStatus: "PENDING",
    KYCStatus: "PENDING",
  },
  expected: [201],
})
const clientId = idOf(clientCreated, "client")
pass("1. Create Client", clientId)

const clientOnboarded = await request("PATCH", `/clients/${clientId}`, {
  token,
  body: {
    status: "ACTIVE",
    onboardingStatus: "COMPLETED",
    KYCStatus: "VERIFIED",
  },
})
if (clientOnboarded.data.client.onboardingStatus !== "COMPLETED") {
  fail("2. Complete Client Onboarding", JSON.stringify(clientOnboarded.data.client))
}
pass("2. Complete Client Onboarding", clientOnboarded.data.client.onboardingStatus)

const agreementCreated = await request("POST", "/agreements", {
  token,
  body: {
    clientId,
    effectiveDate: TODAY,
    signedDate: TODAY,
    status: "ACTIVE",
    commercialTerms: { recruitmentFee: 8.5, feeType: "PERCENTAGE", paymentTermsDays: 30 },
    ownershipPeriodMonths: 6,
    duplicateNotificationDays: 30,
    replacementPeriodDays: 90,
  },
  expected: [201],
})
const agreementId = idOf(agreementCreated, "agreement")
pass("3. Create Agreement", agreementCreated.data.agreement.agreementNumber)

const mandateCreated = await request("POST", "/mandates", {
  token,
  body: {
    clientId,
    agreementId,
    position: "Senior Recruiter",
    location: "Bengaluru",
    workMode: "HYBRID",
    vacancies: 1,
    assignedRecruiters: [userId],
    recruitmentFee: 8.5,
    feeType: "PERCENTAGE",
    replacementPeriodDays: 90,
    priority: "HIGH",
    status: "OPEN",
  },
  expected: [201],
})
const mandateId = idOf(mandateCreated, "mandate")
pass("4. Create Recruitment Mandate", mandateCreated.data.mandate.mandateNumber)

const candidateCreated = await request("POST", "/candidates", {
  token,
  body: {
    firstName: "Ada",
    lastName: "Lovelace",
    email: `ada.${stamp}@example.com`,
    phone: `98${String(stamp).slice(-8)}`,
    currentCompany: "Example Labs",
    currentDesignation: "Lead Engineer",
    totalExperience: 8,
    relevantExperience: 6,
    source: "LINKEDIN",
    status: "ACTIVE",
    skills: ["TypeScript", "Node.js"],
  },
  expected: [201],
})
const candidateId = idOf(candidateCreated, "candidate")
pass("5. Create Candidate", candidateCreated.data.candidate.candidateNumber)

const consentCreated = await request("POST", "/consents", {
  token,
  body: {
    candidateId,
    mandateId,
    consentGiven: true,
    consentDate: TODAY,
    consentMethod: "FORM",
    consentPurpose: "SUBMISSION",
  },
  expected: [201],
})
const consentId = idOf(consentCreated, "consent")
if (!consentCreated.data.consent.consentGiven) fail("6. Record Candidate Consent", "consentGiven false")
pass("6. Record Candidate Consent", consentId)

const evaluationCreated = await request("POST", "/evaluations", {
  token,
  body: {
    candidateId,
    mandateId,
    recruiterId: userId,
    scores: {
      roleFit: 8,
      experienceFit: 8,
      communication: 9,
      industryExperience: 7,
      compensationFit: 8,
      joiningProbability: 8,
    },
    recommendation: "RECOMMENDED",
    strengths: ["Strong communication"],
    remarks: "Ready to submit",
    evaluatedAt: TODAY,
  },
  expected: [201],
})
const evaluationId = idOf(evaluationCreated, "evaluation")
pass("7. Create Candidate Evaluation", evaluationCreated.data.evaluation.recommendation)

const submissionCreated = await request("POST", "/submissions", {
  token,
  body: {
    candidateId,
    mandateId,
    clientId,
    evaluationId,
    submittedAt: TODAY,
    status: "SUBMITTED",
    clientAcknowledgement: true,
    acknowledgementDate: TODAY,
    duplicateStatus: "NOT_CHECKED",
  },
  expected: [201],
})
const submissionId = idOf(submissionCreated, "submission")
pass("8. Submit Candidate", submissionCreated.data.submission.status)

const duplicateChecked = await request("PATCH", `/submissions/${submissionId}`, {
  token,
  body: {
    duplicateStatus: "UNIQUE",
    duplicateEvidence: "No overlapping ownership in the last 6 months",
  },
})
if (duplicateChecked.data.submission.duplicateStatus !== "UNIQUE") {
  fail("9. Check Duplicate Candidate", JSON.stringify(duplicateChecked.data.submission))
}
pass("9. Check Duplicate Candidate", duplicateChecked.data.submission.duplicateStatus)

const interviewCreated = await request("POST", "/interviews", {
  token,
  body: {
    submissionId,
    candidateId,
    mandateId,
    round: 1,
    interviewType: "VIDEO",
    scheduledAt: new Date().toISOString(),
    duration: 45,
    interviewers: [userId],
    status: "SCHEDULED",
  },
  expected: [201],
})
const interviewId = idOf(interviewCreated, "interview")
pass("10. Schedule Interview", interviewCreated.data.interview.status)

const interviewUpdated = await request("PATCH", `/interviews/${interviewId}`, {
  token,
  body: {
    status: "COMPLETED",
    decision: "SELECTED",
    nextAction: "Release offer",
    feedback: {
      technicalScore: 8,
      communicationScore: 9,
      cultureFitScore: 8,
      leadershipScore: 7,
      compensationFit: 8,
      joiningRisk: 2,
      comments: "Clear communicator, hire",
    },
  },
})
if (interviewUpdated.data.interview.decision !== "SELECTED") {
  fail("11. Add Interview Feedback", JSON.stringify(interviewUpdated.data.interview))
}
pass("11. Add Interview Feedback", interviewUpdated.data.interview.decision)

const offerCreated = await request("POST", "/offers", {
  token,
  body: {
    submissionId,
    candidateId,
    mandateId,
    offeredDesignation: "Senior Recruiter",
    offeredCTC: 1800000,
    offerDate: TODAY,
    offerStatus: "SENT",
    expectedJoiningDate: JOINING,
    joiningStatus: "PENDING",
  },
  expected: [201],
})
const offerId = idOf(offerCreated, "offer")
pass("12. Create Offer", offerCreated.data.offer.offerStatus)

const offerAccepted = await request("PATCH", `/offers/${offerId}`, {
  token,
  body: { offerStatus: "ACCEPTED" },
})
if (offerAccepted.data.offer.offerStatus !== "ACCEPTED") {
  fail("13. Accept Offer", JSON.stringify(offerAccepted.data.offer))
}
pass("13. Accept Offer", offerAccepted.data.offer.offerStatus)

const followUpCreated = await request("POST", "/follow-ups", {
  token,
  body: {
    offerId,
    candidateId,
    followUpDate: TODAY,
    followUpType: "CALL",
    candidateStatus: "CONFIRMED",
    joiningProbability: 9,
    riskLevel: "LOW",
    remarks: "Confirmed joining date",
  },
  expected: [201],
})
pass("14. Record Pre-Joining Follow-ups", followUpCreated.data.followUp.candidateStatus)

const joiningCreated = await request("POST", "/joinings", {
  token,
  body: {
    offerId,
    candidateId,
    mandateId,
    clientId,
    joiningDate: JOINING,
    status: "JOINED",
    confirmedBy: userId,
    confirmationDate: TODAY,
    remarks: "Joined as planned",
  },
  expected: [201],
})
const joiningId = idOf(joiningCreated, "joining")
if (joiningCreated.data.joining.status !== "JOINED") {
  fail("15. Confirm Joining", JSON.stringify(joiningCreated.data.joining))
}
pass("15. Confirm Joining", joiningCreated.data.joining.status)

const invoiceCreated = await request("POST", "/invoices", {
  token,
  body: {
    clientId,
    joiningId,
    invoiceDate: TODAY,
    amount: 153000,
    status: "SENT",
    remarks: "8.5% of offered CTC",
  },
  expected: [201],
})
const invoiceId = idOf(invoiceCreated, "invoice")
pass("16. Create Invoice", invoiceCreated.data.invoice.invoiceNumber)

const paymentCreated = await request("POST", "/payments", {
  token,
  body: {
    invoiceId,
    amount: 153000,
    paymentDate: TODAY,
    paymentMethod: "NEFT",
    transactionReference: `NEFT${stamp}`,
    status: "COMPLETED",
  },
  expected: [201],
})
if (paymentCreated.data.payment.status !== "COMPLETED") {
  fail("17. Record Payment", JSON.stringify(paymentCreated.data.payment))
}
pass("17. Record Payment", `${paymentCreated.data.payment.status} ${paymentCreated.data.payment.amount}`)

const guaranteeCreated = await request("POST", "/guarantees", {
  token,
  body: {
    joiningId,
    candidateId,
    mandateId,
    clientId,
    joiningDate: JOINING,
    retentionStatus: "IN_PROGRESS",
  },
  expected: [201],
})
const guaranteeId = idOf(guaranteeCreated, "guarantee")
pass("18. Track Guarantee", `${guaranteeCreated.data.guarantee.retentionStatus} ${guaranteeId}`)

const replacementCandidate = await request("POST", "/candidates", {
  token,
  body: {
    firstName: "Grace",
    lastName: "Hopper",
    email: `grace.${stamp}@example.com`,
    phone: `97${String(stamp).slice(-8)}`,
    source: "REFERRAL",
    status: "ACTIVE",
  },
  expected: [201],
})
const replacementCandidateId = idOf(replacementCandidate, "candidate")

const replacementCreated = await request("POST", "/replacements", {
  token,
  body: {
    joiningId,
    candidateId,
    mandateId,
    clientId,
    replacementReason: "PERFORMANCE",
    replacementRequestedDate: TODAY,
    status: "REPLACEMENT_REQUESTED",
    replacementCandidateId,
    remarks: "Client requested a replacement during guarantee",
  },
  expected: [201],
})
pass("19. Create Replacement Case", replacementCreated.data.replacement.status)

const dashboard = await request("GET", `/dashboard/recruitment?from=${TODAY}&to=${TODAY}&clientId=${clientId}&mandateId=${mandateId}`, {
  token,
})
const metrics = dashboard.data.metrics
const checks = {
  activeClients: metrics.activeClients >= 1,
  openMandates: metrics.openMandates >= 1,
  totalCandidates: metrics.totalCandidates >= 1,
  candidatesSourced: metrics.candidatesSourced >= 1,
  candidatesScreened: metrics.candidatesScreened >= 1,
  candidatesSubmitted: metrics.candidatesSubmitted >= 1,
  interviewsScheduled: metrics.interviewsScheduled >= 1,
  candidatesJoined: metrics.candidatesJoined >= 1,
  revenue: metrics.revenue >= 153000,
}

const failedMetrics = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => `${key}=${metrics[key]}`)
if (failedMetrics.length) {
  fail("20. Verify Dashboard metrics", `${failedMetrics.join(", ")} | ${JSON.stringify(metrics)}`)
}
pass("20. Verify Dashboard metrics", JSON.stringify(checks))

console.log("\nWorkflow complete")
console.log(RESULTS.map((line, index) => `${index + 1}. ${line}`).join("\n"))
