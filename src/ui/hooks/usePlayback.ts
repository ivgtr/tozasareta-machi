import { useCallback, useEffect, useState } from 'react'
import type { Effect, GameState } from '../../game/types'
import { UI_TIMING } from '../data/ui-timing'

export interface Playback {
  prev: GameState
  effects: Effect[]
  index: number
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function usePlayback() {
  const [pb, setPb] = useState<Playback | null>(null)

  const start = useCallback((prev: GameState, effects: Effect[]) => {
    if (effects.length === 0 || prefersReducedMotion()) return
    setPb({ prev, effects, index: 0 })
  }, [])

  const skip = useCallback(() => setPb(null), [])

  useEffect(() => {
    if (!pb) return
    const id = setInterval(() => {
      setPb((cur) => {
        if (!cur) return cur
        if (cur.index >= cur.effects.length) {
          clearInterval(id)
          return null
        }
        return { ...cur, index: cur.index + 1 }
      })
    }, UI_TIMING.effectMs)
    return () => clearInterval(id)
  }, [pb])

  return { pb, start, skip }
}
