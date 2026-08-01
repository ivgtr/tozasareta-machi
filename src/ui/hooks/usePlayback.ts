import { useCallback, useEffect, useState } from 'react'
import type { Effect, GameState } from '../../game/types'
import { UI_TIMING } from '../data/ui-timing'
import { reducedMotion } from '../settings'

export interface Playback {
  prev: GameState
  effects: Effect[]
  index: number
  confirmed: boolean
}

export function usePlayback(pauseOn: (e: Effect) => boolean = () => false) {
  const [pb, setPb] = useState<Playback | null>(null)

  const start = useCallback((prev: GameState, effects: Effect[]) => {
    if (effects.length === 0 || reducedMotion()) return
    setPb({ prev, effects, index: 0, confirmed: false })
  }, [])

  const skip = useCallback(() => setPb(null), [])
  const confirm = useCallback(() => setPb((cur) => (cur ? { ...cur, confirmed: true } : cur)), [])

  useEffect(() => {
    if (!pb) return
    const current = pb.index > 0 ? (pb.effects[pb.index - 1] ?? undefined) : undefined
    if (current && !pb.confirmed && pauseOn(current)) return
    const id = setTimeout(() => {
      setPb((cur) => {
        if (!cur) return cur
        if (cur.index >= cur.effects.length) return null
        return { ...cur, index: cur.index + 1, confirmed: false }
      })
    }, UI_TIMING.effectMs)
    return () => clearTimeout(id)
  }, [pb, pauseOn])

  const waiting =
    pb !== null && pb.index > 0 && !pb.confirmed && pauseOn(pb.effects[pb.index - 1] as Effect)

  return { pb, waiting, start, skip, confirm }
}
