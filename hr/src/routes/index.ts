import { Router } from "express"

import { authRouter } from "./auth.routes.js"
import { accessRouter } from "./access.routes.js"
import { payrollRouter } from "./payroll.routes.js"
import { clientsRouter } from "./client.routes.js"
import { agreementsRouter } from "./agreement.routes.js"
import { mandatesRouter } from "./mandate.routes.js"
import { candidatesRouter } from "./candidate.routes.js"
import { consentsRouter } from "./consent.routes.js"
import { evaluationsRouter } from "./evaluation.routes.js"
import { submissionsRouter } from "./submission.routes.js"
import { interviewsRouter } from "./interview.routes.js"
import { offersRouter } from "./offer.routes.js"
import { followUpsRouter } from "./follow-up.routes.js"
import { joiningsRouter } from "./joining.routes.js"
import { invoicesRouter } from "./invoice.routes.js"
import { paymentsRouter } from "./payment.routes.js"
import { guaranteesRouter } from "./guarantee.routes.js"
import { replacementsRouter } from "./replacement.routes.js"
import { auditLogsRouter } from "./audit.routes.js"
import { recruitmentRouter } from "./recruitment.routes.js"
import { careersRouter } from "./career.routes.js"
import { publicCareersRouter } from "./public-career.routes.js"
import { publicFilesRouter } from "./local-file.routes.js"
import { jobApplicationsRouter } from "./job-application.routes.js"
import { pipelineRouter } from "./pipeline.routes.js"
import { performanceRouter } from "./performance.routes.js"
import { reportsRouter } from "./reports.routes.js"
import { employeeRouter } from "./employee.routes.js"
import { usersRouter } from "./user.routes.js"
import { dashboardRouter } from "./dashboard.routes.js"
import { attendanceRouter } from "./attendance.routes.js"
import { documentsRouter } from "./document.routes.js"
import { assetsRouter } from "./asset.routes.js"
import { announcementsRouter } from "./announcement.routes.js"
import { notificationsRouter } from "./notification.routes.js"
import { leaveRouter } from "./leave.routes.js"
import { aiInterviewsRouter, jobApplicationAiRouter } from "./ai-interview.routes.js"
import { healthRouter } from "./health.routes.js"
import {
  departmentRouter,
  designationRouter,
  organizationRouter,
} from "./organization.routes.js"

export function createApiRouter() {
  const router = Router()

  router.use("/health", healthRouter)
  router.use("/auth", authRouter)
  router.use("/access", accessRouter)
  router.use("/dashboard", dashboardRouter)
  router.use("/organization", organizationRouter)
  router.use("/employees", employeeRouter)
  router.use("/users", usersRouter)
  router.use("/departments", departmentRouter)
  router.use("/designations", designationRouter)
  router.use("/attendance", attendanceRouter)
  router.use("/leave", leaveRouter)
  router.use("/documents", documentsRouter)
  router.use("/assets", assetsRouter)
  router.use("/announcements", announcementsRouter)
  router.use("/notifications", notificationsRouter)
  router.use("/payroll", payrollRouter)
  router.use("/clients", clientsRouter)
  router.use("/agreements", agreementsRouter)
  router.use("/mandates", mandatesRouter)
  router.use("/candidates", candidatesRouter)
  router.use("/consents", consentsRouter)
  router.use("/evaluations", evaluationsRouter)
  router.use("/submissions", submissionsRouter)
  router.use("/interviews", interviewsRouter)
  router.use("/offers", offersRouter)
  router.use("/follow-ups", followUpsRouter)
  router.use("/joinings", joiningsRouter)
  router.use("/invoices", invoicesRouter)
  router.use("/payments", paymentsRouter)
  router.use("/guarantees", guaranteesRouter)
  router.use("/replacements", replacementsRouter)
  router.use("/audit-logs", auditLogsRouter)
  router.use("/recruitment", recruitmentRouter)
  router.use("/job-applications", jobApplicationsRouter)
  router.use("/job-applications", jobApplicationAiRouter)
  router.use("/ai-interviews", aiInterviewsRouter)
  router.use("/pipeline", pipelineRouter)
  router.use("/public/careers", publicCareersRouter)
  router.use("/public/files", publicFilesRouter)
  router.use("/careers", careersRouter)
  router.use("/performance", performanceRouter)
  router.use("/reports", reportsRouter)

  return router
}
