import nodemailer, { type Transporter } from "nodemailer"

import { env } from "../config/env.js"

export type SendEmailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

function smtpConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM)
}

let transporter: Transporter | null = null

function getTransporter() {
  if (!smtpConfigured()) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
    })
  }
  return transporter
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const to = input.to.trim()
  if (!to) {
    console.warn("[Email] Skipped: missing recipient")
    return false
  }

  const transport = getTransporter()
  if (!transport) {
    console.info("[Email] (SMTP not configured — logged only)")
    console.info(`  To: ${to}`)
    console.info(`  Subject: ${input.subject}`)
    console.info(`  Body:\n${input.text}`)
    return true
  }

  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    })
    return true
  } catch (error) {
    console.error("[Email] Failed to send", { to, subject: input.subject, error })
    return false
  }
}

export function buildInterviewInvitationEmail(input: {
  candidateName: string
  jobTitle: string
  companyName: string
  interviewLink: string
  expiryDate: string
  durationMinutes: number
}) {
  const text = `Hi ${input.candidateName},

Thank you for applying for the ${input.jobTitle} position at ${input.companyName}.

You have been selected for the AI assessment round.

The interview will include 5 questions generated based on your resume and the job requirements.
Estimated duration: ${input.durationMinutes} minutes.

Please complete the interview using the link below:
${input.interviewLink}

Please complete the assessment before:
${input.expiryDate}

Best of luck!`

  return {
    subject: `AI Interview Invitation — ${input.jobTitle} at ${input.companyName}`,
    text,
  }
}

export function buildInterviewLink(token: string) {
  return `${env.APP_URL}/ai-interview/${token}`
}

export type ScheduledInterviewEmailInput = {
  recipientName: string
  candidateName: string
  interviewerNames: string[]
  position: string
  companyName: string
  round: number
  interviewTypeLabel: string
  scheduledAtLabel: string
  durationMinutes: number
  isUpdate?: boolean
}

export function buildCandidateInterviewEmail(input: ScheduledInterviewEmailInput) {
  const action = input.isUpdate ? "updated" : "scheduled"
  const interviewers =
    input.interviewerNames.length > 0
      ? input.interviewerNames.join(", ")
      : "To be confirmed"

  const text = `Hi ${input.recipientName},

Your interview for the ${input.position} role at ${input.companyName} has been ${action}.

Details:
- Round: ${input.round}
- Type: ${input.interviewTypeLabel}
- When: ${input.scheduledAtLabel}
- Duration: ${input.durationMinutes} minutes
- Interviewer(s): ${interviewers}

Please be available at the scheduled time. If you need to reschedule, reply to this email or contact your recruiter.

Best regards,
${input.companyName}`

  return {
    subject: `Interview ${action}: ${input.position} at ${input.companyName}`,
    text,
  }
}

export function buildInterviewerInterviewEmail(input: ScheduledInterviewEmailInput) {
  const action = input.isUpdate ? "updated" : "scheduled"
  const others = input.interviewerNames.filter(
    (name) => name.toLowerCase() !== input.recipientName.toLowerCase()
  )

  const text = `Hi ${input.recipientName},

An interview has been ${action} and you are listed as an interviewer.

Details:
- Candidate: ${input.candidateName}
- Position: ${input.position}
- Company: ${input.companyName}
- Round: ${input.round}
- Type: ${input.interviewTypeLabel}
- When: ${input.scheduledAtLabel}
- Duration: ${input.durationMinutes} minutes${
    others.length > 0 ? `\n- Other interviewer(s): ${others.join(", ")}` : ""
  }

Please join at the scheduled time.

Best regards,
${input.companyName}`

  return {
    subject: `Interview ${action}: ${input.candidateName} — ${input.position}`,
    text,
  }
}
