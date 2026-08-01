import { useCallback, useEffect, useState } from 'react'
import type { Effect, GameState } from '../../game/types'
import { UI_TIMING } from '../data/ui-timing'
import { reducedMotion } from '../settings'

export type Beat =
  | { kind: 'flow'; effects: [Effect] }
  | { kind: 'event'; id: string; effects: Effect[] }
  | { kind: 'arrival'; unitId: string; effects: Effect[] }

export interface Playback {
  prev: GameState
  beats: Beat[]
  index: number
  confirmed: boolean
}

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

export function usePlayback() {
  const [pb, setPb] = useState<Playback | null>(null)

  const start = useCallback((prev: GameState, effects: Effect[]) => {
    if (effects.length === 0 || reducedMotion()) return
    setPb({ prev, beats: buildBeats(effects), index: 0, confirmed: false })
  }, [])

  const skip = useCallback(() => setPb(null), [])
  const confirm = useCallback(() => setPb((cur) => (cur ? { ...cur, confirmed: true } : cur)), [])

  useEffect(() => {
    if (!pb) return
    const beat = pb.beats[pb.index]
    if (!beat) return
    const spotlight = beat.kind !== 'flow'
    if (spotlight && !pb.confirmed) return
    const delay = spotlight ? UI_TIMING.afterConfirmMs : UI_TIMING.effectMs
    const t = setTimeout(() => {
      setPb((cur) => {
        if (!cur) return cur
        const next = cur.index + 1
        return next >= cur.beats.length ? null : { ...cur, index: next, confirmed: false }
      })
    }, delay)
    return () => clearTimeout(t)
  }, [pb])

  const current = pb ? (pb.beats[pb.index] ?? undefined) : undefined
  const waiting = pb !== null && current !== undefined && current.kind !== 'flow' && !pb.confirmed

  return { pb, waiting, start, skip, confirm }
}
