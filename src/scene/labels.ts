export const TARGET_LABEL: Record<string, string> = {
  food: '食料',
  power: '電力',
  medical: '医療',
  morale: '士気',
  budget: '予算',
  stockpile: '備蓄',
}

export function formatDelta(target: string, delta: number): string {
  return `${TARGET_LABEL[target] ?? target} ${delta >= 0 ? '+' : ''}${delta}`
}
