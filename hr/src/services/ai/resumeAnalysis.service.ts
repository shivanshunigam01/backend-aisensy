import {
  RESUME_ANALYSIS_SYSTEM_PROMPT,
  buildResumeAnalysisUserPrompt,
} from "./prompts/resume-analysis.prompt.js"
import { aiCompleteJson, logAiEvent } from "./ai-provider.js"

export type ResumeAnalysisResult = {
  candidateName: string
  skills: string[]
  experience: string[]
  projects: string[]
  education: string[]
  technologies: string[]
  strengths: string[]
  missingSkills: string[]
  jobMatchScore: number
}

export async function analyzeResumeAndJob(input: {
  candidateName: string
  candidateProfile: string
  jobTitle: string
  jobDescription: string
  requiredSkills: string[]
}): Promise<ResumeAnalysisResult> {
  logAiEvent("resume_analysis_started", { candidateName: input.candidateName, jobTitle: input.jobTitle })

  const result = await aiCompleteJson<ResumeAnalysisResult>({
    messages: [
      { role: "system", content: RESUME_ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: buildResumeAnalysisUserPrompt(input) },
    ],
  })

  logAiEvent("resume_analysis_completed", {
    candidateName: input.candidateName,
    jobMatchScore: result.jobMatchScore,
  })

  return {
    candidateName: result.candidateName || input.candidateName,
    skills: result.skills ?? [],
    experience: result.experience ?? [],
    projects: result.projects ?? [],
    education: result.education ?? [],
    technologies: result.technologies ?? [],
    strengths: result.strengths ?? [],
    missingSkills: result.missingSkills ?? [],
    jobMatchScore: Math.min(100, Math.max(0, Number(result.jobMatchScore) || 0)),
  }
}
