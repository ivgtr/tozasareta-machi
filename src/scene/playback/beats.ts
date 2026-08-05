import type { Effect } from '../../game/types'

export const UI_TIMING = {
  effectMs: 650,
  afterConfirmMs: 250,
} as const

export type Beat =
  | { kind: 'flow'; effects: [Effect] }
  | { kind: 'event'; id: string; effects: Effect[] }
  | { kind: 'arrival'; unitId: string; effects: Effect[] }

export function buildBeats(effects: Effect[]): Beat[] {
  const beats: Beat[] = []
  let i = 0
  while (i < effects.length) {
    const e = effects[i]
    if (!e) break
    if (e.source.startsWith('event:')) {
      const src = e.source
      const group: Effect[] = []
      while (i < effects.length && effects[i]?.source === src) {
        const g = effects[i]
        if (g) group.push(g)
        i++
      }
      const unitEffect = group.find((g) => g.target.startsWith('unit:'))
      if (unitEffect) {
        beats.push({
          kind: 'arrival',
          unitId: unitEffect.target.slice('unit:'.length),
          effects: group,
        })
      } else {
        beats.push({ kind: 'event', id: src.slice('event:'.length), effects: group })
      }
    } else {
      beats.push({ kind: 'flow', effects: [e] })
      i++
    }
  }
  return beats
}
