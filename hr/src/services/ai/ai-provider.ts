import { env } from "../../config/env.js"

export type AiChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type AiCompletionOptions = {
  messages: AiChatMessage[]
  temperature?: number
  jsonMode?: boolean
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced?.[1]?.trim() ?? trimmed
  return JSON.parse(raw)
}

async function callOpenAi(options: AiCompletionOptions): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenAI API error (${response.status}): ${body}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content ?? ""
}

function mockCompletion(options: AiCompletionOptions): string {
  const userContent = options.messages.find((m) => m.role === "user")?.content ?? ""

  if (userContent.includes("Analyze this candidate")) {
    const nameMatch = userContent.match(/CANDIDATE NAME: (.+)/)
    const skillsMatch = userContent.match(/REQUIRED SKILLS:\n(.+)/)
    const requiredSkills = (skillsMatch?.[1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

    return JSON.stringify({
      candidateName: nameMatch?.[1]?.trim() ?? "Candidate",
      skills: requiredSkills.slice(0, 5),
      experience: ["Professional experience in relevant domain"],
      projects: ["Built scalable web applications"],
      education: ["Relevant technical education"],
      technologies: requiredSkills.slice(0, 4),
      strengths: ["Strong technical foundation", "Relevant project experience"],
      missingSkills: requiredSkills.length > 2 ? [requiredSkills[requiredSkills.length - 1]] : [],
      jobMatchScore: Math.min(85, 60 + requiredSkills.length * 5),
    })
  }

  if (userContent.includes("Generate 5 personalized")) {
    const techMatch = userContent.match(/technologies.*?(\w+)/i)
    const tech = techMatch?.[1] ?? "the required technology"
    const questions = [
      {
        order: 1,
        question: `Explain a challenging ${tech} performance issue you solved in one of your projects.`,
        category: "TECHNICAL",
        difficulty: "MEDIUM",
      },
      {
        order: 2,
        question: "In your previous project, how did you manage API state and caching?",
        category: "ARCHITECTURE",
        difficulty: "MEDIUM",
      },
      {
        order: 3,
        question: `How would you design authentication between a frontend and backend using ${tech}?`,
        category: "ARCHITECTURE",
        difficulty: "HARD",
      },
      {
        order: 4,
        question: "Explain a real-world scenario where you optimized application performance.",
        category: "PROBLEM_SOLVING",
        difficulty: "MEDIUM",
      },
      {
        order: 5,
        question: "Based on your previous project experience, how would you approach building a large-scale application?",
        category: "EXPERIENCE",
        difficulty: "HARD",
      },
    ]
    return JSON.stringify({ questions })
  }

  if (userContent.includes("Evaluate this interview answer")) {
    const answerMatch = userContent.match(/CANDIDATE ANSWER:\n([\s\S]+)/)
    const answer = answerMatch?.[1]?.trim() ?? ""
    const wordCount = answer.split(/\s+/).filter(Boolean).length
    const baseScore = Math.min(95, Math.max(40, 50 + wordCount * 2))

    return JSON.stringify({
      questionScore: baseScore,
      technicalAccuracy: baseScore + 2,
      communication: baseScore - 3,
      problemSolving: baseScore,
      relevance: baseScore + 1,
      feedback:
        wordCount > 20
          ? "The candidate demonstrated solid knowledge with practical examples."
          : "The answer was brief. More depth and specific examples would strengthen the response.",
    })
  }

  if (userContent.includes("Provide a final interview assessment")) {
    const scoreMatch = userContent.match(/CALCULATED FINAL SCORE: (\d+)/)
    const finalScore = Number(scoreMatch?.[1] ?? 70)
    return JSON.stringify({
      technicalScore: finalScore,
      communicationScore: finalScore - 2,
      problemSolvingScore: finalScore + 1,
      relevanceScore: finalScore,
      overallFeedback: "The candidate showed consistent performance across all questions.",
      strengths: ["Technical knowledge", "Problem-solving approach"],
      weaknesses: ["Could provide more detailed examples"],
      recommendation:
        finalScore >= 70
          ? "Recommend proceeding to the next recruitment stage."
          : "Recommend recruiter review before proceeding.",
    })
  }

  return JSON.stringify({ result: "mock response" })
}

export async function aiCompleteJson<T>(options: AiCompletionOptions): Promise<T> {
  const useOpenAi = env.AI_PROVIDER === "openai" && env.OPENAI_API_KEY
  const content = useOpenAi
    ? await callOpenAi({ ...options, jsonMode: true })
    : mockCompletion({ ...options, jsonMode: true })

  return extractJson(content) as T
}

export function logAiEvent(event: string, details: Record<string, unknown>) {
  console.info(`[AI Interview] ${event}`, JSON.stringify(details))
}
