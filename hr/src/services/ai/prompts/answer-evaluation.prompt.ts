export const ANSWER_EVALUATION_SYSTEM_PROMPT = `You are an expert technical interviewer evaluating candidate answers.
Evaluate the answer based on technical accuracy, relevance, depth of knowledge, practical experience, communication clarity, and problem-solving ability.
Return ONLY valid JSON with no markdown formatting.
The JSON must match this exact structure:
{
  "questionScore": number (0-100),
  "technicalAccuracy": number (0-100),
  "communication": number (0-100),
  "problemSolving": number (0-100),
  "relevance": number (0-100),
  "feedback": "string with constructive feedback"
}`

export function buildAnswerEvaluationUserPrompt(input: {
  question: string
  category: string
  candidateAnswer: string
  jobTitle: string
  requiredSkills: string[]
}) {
  return `Evaluate this interview answer.

JOB TITLE: ${input.jobTitle}
REQUIRED SKILLS: ${input.requiredSkills.join(", ") || "Not specified"}

QUESTION (${input.category}):
${input.question}

CANDIDATE ANSWER:
${input.candidateAnswer}

Provide scores and constructive feedback.`
}

export const FINAL_EVALUATION_SYSTEM_PROMPT = `You are an expert technical recruiter providing a final interview assessment.
Based on all question evaluations, provide an overall assessment.
Return ONLY valid JSON with no markdown formatting.
The JSON must match this exact structure:
{
  "technicalScore": number (0-100),
  "communicationScore": number (0-100),
  "problemSolvingScore": number (0-100),
  "relevanceScore": number (0-100),
  "overallFeedback": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "recommendation": "string"
}`

export function buildFinalEvaluationUserPrompt(input: {
  candidateName: string
  jobTitle: string
  questionEvaluations: Array<{
    question: string
    score: number
    feedback: string
  }>
  finalScore: number
}) {
  return `Provide a final interview assessment.

CANDIDATE: ${input.candidateName}
JOB TITLE: ${input.jobTitle}
CALCULATED FINAL SCORE: ${input.finalScore}%

QUESTION EVALUATIONS:
${input.questionEvaluations.map((q, i) => `${i + 1}. ${q.question}\nScore: ${q.score}\nFeedback: ${q.feedback}`).join("\n\n")}

Provide overall assessment with strengths, weaknesses, and recommendation.`
}
