import { describe, expect, it } from "vitest"

import {
  approximateScorecardFromLegacy,
  calculateLegacyTotalScore,
  calculateScorecardTotal,
  calculateTotalScore,
  normalizeScorecard,
} from "./evaluation-score.js"

describe("calculateTotalScore", () => {
  it("averages the six score fields to one decimal", () => {
    expect(
      calculateTotalScore({
        roleFit: 8,
        experienceFit: 7,
        communication: 9,
        industryExperience: 6,
        compensationFit: 8,
        joiningProbability: 7,
      })
    ).toBe(7.5)
  })

  it("returns 0 when scores are missing", () => {
    expect(calculateTotalScore(undefined)).toBe(0)
    expect(calculateLegacyTotalScore(undefined)).toBe(0)
  })
})

describe("calculateScorecardTotal", () => {
  it("sums the 100-point scorecard", () => {
    const scorecard = normalizeScorecard({
      communication: 8,
      roleKnowledge: 16,
      relevantExperience: 18,
      achievementEvidence: 12,
      stability: 8,
      locationFit: 7,
      ctcFit: 4,
      joiningProbability: 9,
    })
    expect(calculateScorecardTotal(scorecard)).toBe(82)
  })

  it("approximates a scorecard from legacy scores", () => {
    const approx = approximateScorecardFromLegacy({
      roleFit: 10,
      experienceFit: 10,
      communication: 10,
      industryExperience: 10,
      compensationFit: 10,
      joiningProbability: 10,
    })
    expect(approx.communication).toBe(10)
    expect(approx.roleKnowledge).toBe(20)
    expect(calculateScorecardTotal(approx)).toBeGreaterThan(50)
  })
})
