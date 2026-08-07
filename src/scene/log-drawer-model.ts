import type { Effect } from '../game/types'

export const COLLAPSED_LOG_LINES = 3
export const EXPANDED_LOG_LINES = 12

export function visibleLogEntries(report: readonly Effect[], expanded: boolean): Effect[] {
  const limit = expanded ? EXPANDED_LOG_LINES : COLLAPSED_LOG_LINES
  return report.slice(-limit)
}
