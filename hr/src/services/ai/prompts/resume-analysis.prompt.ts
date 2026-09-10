export const RESUME_ANALYSIS_SYSTEM_PROMPT = `You are an expert technical recruiter and resume analyst.
Analyze the candidate profile against the job requirements and return ONLY valid JSON with no markdown formatting.
The JSON must match this exact structure:
{
  "candidateName": "string",
  "skills": ["string"],
  "experience": ["string"],
  "projects": ["string"],
  "education": ["string"],
  "technologies": ["string"],
  "strengths": ["string"],
  "missingSkills": ["string"],
  "jobMatchScore": number (0-100)
}
Be specific and base your analysis on the provided data. Do not invent credentials not supported by the resume data.`

export function buildResumeAnalysisUserPrompt(input: {
  candidateName: string
  candidateProfile: string
  jobTitle: string
  jobDescription: string
  requiredSkills: string[]
}) {
  return `Analyze this candidate for the job role.

CANDIDATE NAME: ${input.candidateName}

CANDIDATE PROFILE:
${input.candidateProfile}

JOB TITLE: ${input.jobTitle}

JOB DESCRIPTION:
${input.jobDescription}

REQUIRED SKILLS:
${input.requiredSkills.join(", ") || "Not specified"}

Return the structured JSON analysis.`
}
