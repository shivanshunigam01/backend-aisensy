import type { ActivityTone } from "../constants/dashboard.js"
import { ActivityModel } from "../models/activity.model.js"

export async function recordActivity(
  organizationId: string,
  input: { title: string; detail?: string; tone?: ActivityTone }
) {
  try {
    await ActivityModel.create({
      organizationId,
      title: input.title,
      detail: input.detail ?? "",
      tone: input.tone ?? "default",
    })
  } catch {
    // Dashboard activity is best-effort and must not fail the source action.
  }
}
