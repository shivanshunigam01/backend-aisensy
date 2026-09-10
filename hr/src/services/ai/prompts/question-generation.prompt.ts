export const QUESTION_GENERATION_SYSTEM_PROMPT = `You are an expert technical interviewer.
Generate exactly 5 personalized interview questions based on the candidate's resume and job requirements.
Questions must NOT be generic — they must reference specific technologies, projects, or experience from the candidate profile.
Return ONLY valid JSON with no markdown formatting.
The JSON must match this exact structure:
{
  "questions": [
    {
      "order": 1,
      "question": "string",
      "category": "TECHNICAL" | "EXPERIENCE" | "PROBLEM_SOLVING" | "ARCHITECTURE" | "BEHAVIORAL",
      "difficulty": "EASY" | "MEDIUM" | "HARD"
    }
  ]
}
Generate exactly 5 questions with orders 1 through 5.`

export function buildQuestionGenerationUserPrompt(input: {
  candidateName: string
  candidateProfile: string
  jobTitle: string
  jobDescription: string
  requiredSkills: string[]
  resumeAnalysis: Record<string, unknown>
}) {
  return `Generate 5 personalized interview questions for this candidate.

CANDIDATE: ${input.candidateName}

CANDIDATE PROFILE:
${input.candidateProfile}

JOB TITLE: ${input.jobTitle}

JOB DESCRIPTION:
${input.jobDescription}

REQUIRED SKILLS: ${input.requiredSkills.join(", ") || "Not specified"}

RESUME ANALYSIS:
${JSON.stringify(input.resumeAnalysis, null, 2)}

Generate questions that reference specific technologies and projects from the candidate's background.`
}
