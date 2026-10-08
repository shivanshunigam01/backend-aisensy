import { env } from "../config/env.js"

export type SendEmailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  console.info("[Email] Interview invitation:")
  console.info(`  To: ${input.to}`)
  console.info(`  Subject: ${input.subject}`)
  console.info(`  Body:\n${input.text}`)
  return true
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
