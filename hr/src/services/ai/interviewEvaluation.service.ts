import type { AiInterviewResult } from "../../constants/ai-interviews.js"
import {
  ANSWER_EVALUATION_SYSTEM_PROMPT,
  FINAL_EVALUATION_SYSTEM_PROMPT,
  buildAnswerEvaluationUserPrompt,
  buildFinalEvaluationUserPrompt,
} from "./prompts/answer-evaluation.prompt.js"
import { aiCompleteJson, logAiEvent } from "./ai-provider.js"

export type AnswerEvaluationResult = {
  questionScore: number
  technicalAccuracy: number
  communication: number
  problemSolving: number
  relevance: number
  feedback: string
}

export type FinalEvaluationResult = {
  technicalScore: number
  communicationScore: number
  problemSolvingScore: number
  relevanceScore: number
  overallFeedback: string
  strengths: string[]
  weaknesses: string[]
  recommendation: string
}

export async function evaluateAnswer(input: {
  question: string
  category: string
  candidateAnswer: string
  jobTitle: string
  requiredSkills: string[]
}): Promise<AnswerEvaluationResult> {
  logAiEvent("answer_evaluation_started", { question: input.question.slice(0, 80) })

  const result = await aiCompleteJson<AnswerEvaluationResult>({
    messages: [
      { role: "system", content: ANSWER_EVALUATION_SYSTEM_PROMPT },
      { role: "user", content: buildAnswerEvaluationUserPrompt(input) },
    ],
  })

  return {
    questionScore: clampScore(result.questionScore),
    technicalAccuracy: clampScore(result.technicalAccuracy),
    communication: clampScore(result.communication),
    problemSolving: clampScore(result.problemSolving),
    relevance: clampScore(result.relevance),
    feedback: String(result.feedback ?? "").trim(),
  }
}

export function calculateFinalScore(scores: number[]): number {
  if (!scores.length) return 0
  const total = scores.reduce((sum, score) => sum + score, 0)
  return Math.round(total / scores.length)
}

export async function generateInterviewFeedback(input: {
  candidateName: string
  jobTitle: string
  questionEvaluations: Array<{ question: string; score: number; feedback: string }>
  finalScore: number
}): Promise<FinalEvaluationResult> {
  logAiEvent("final_evaluation_started", {
    candidateName: input.candidateName,
    finalScore: input.finalScore,
  })

  const result = await aiCompleteJson<FinalEvaluationResult>({
    messages: [
      { role: "system", content: FINAL_EVALUATION_SYSTEM_PROMPT },
      { role: "user", content: buildFinalEvaluationUserPrompt(input) },
    ],
  })

  return {
    technicalScore: clampScore(result.technicalScore),
    communicationScore: clampScore(result.communicationScore),
    problemSolvingScore: clampScore(result.problemSolvingScore),
    relevanceScore: clampScore(result.relevanceScore),
    overallFeedback: String(result.overallFeedback ?? "").trim(),
    strengths: result.strengths ?? [],
    weaknesses: result.weaknesses ?? [],
    recommendation: String(result.recommendation ?? "").trim(),
  }
}

export function determineResult(finalScore: number, passingScore: number): AiInterviewResult {
  return finalScore >= passingScore ? "PASSED" : "FAILED"
}

function clampScore(value: unknown): number {
  const num = Number(value)
  if (Number.isNaN(num)) return 0
  return Math.min(100, Math.max(0, Math.round(num)))
}
