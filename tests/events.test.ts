import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { runEvents } from '../src/game/events'
import { EVENTS } from '../src/game/data/events-data'
import type { GameState } from '../src/game/types'

const base = (): GameState => createInitialState(3)

describe('events', () => {
  it('発火したイベントは event: 由来の effect を返す', () => {
    const s: GameState = { ...base(), day: 12 }
    const { effects } = runEvents(s)
    if (effects.length > 0) {
      expect(effects[0]?.source.startsWith('event:')).toBe(true)
    }
  })

  it('同じ状態なら同じ結果（決定性）', () => {
    const s: GameState = { ...base(), day: 15 }
    const a = runEvents(s)
    const b = runEvents(s)
    expect(a).toEqual(b)
  })

  it('once イベントは二度発火しない', () => {
    let s: GameState = { ...base(), day: 20 }
    const rescue = EVENTS.find((e) => e.id === 'rescue_contact')
    expect(rescue?.once).toBe(true)
    let firedSeen = false
    for (let i = 0; i < 30; i++) {
      const r = runEvents(s)
      s = r.state
      if (s.flags.fired.includes('rescue_contact')) {
        firedSeen = true
        break
      }
    }
    expect(firedSeen).toBe(true)
    expect(s.flags.fired.filter((id) => id === 'rescue_contact')).toHaveLength(1)
  })

  it('感染症は医療が低いときだけ候補になる', () => {
    const infection = EVENTS.find((e) => e.id === 'infection')!
    const healthy: GameState = { ...base(), resources: { ...base().resources, medical: 80 } }
    const sick: GameState = { ...base(), resources: { ...base().resources, medical: 10 } }
    expect(infection.when({ state: healthy, flags: healthy.flags, day: 10 })).toBe(false)
    expect(infection.when({ state: sick, flags: sick.flags, day: 10 })).toBe(true)
    expect(
      infection.weight({ state: sick, flags: { ...sick.flags, daysWithoutMedical: 5 }, day: 10 }),
    ).toBeGreaterThan(infection.weight({ state: sick, flags: sick.flags, day: 10 }))
  })
})
