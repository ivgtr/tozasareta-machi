import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { runEvents } from '../src/game/events'
import { EVENTS } from '../src/game/data/events-data'
import { UNIQUE_UNITS } from '../src/game/data/units'
import { BALANCE } from '../src/game/data/balance'
import type { GameState } from '../src/game/types'

const base = (): GameState => createInitialState(3)

describe('events', () => {
  it('同じ状態なら同じ結果（決定性）', () => {
    const s: GameState = { ...base(), day: 15 }
    expect(runEvents(s)).toEqual(runEvents(s))
  })

  it('到着イベントはユニットを1人追加し、unit: 効果を持つ', () => {
    const arrival = EVENTS.find((e) => e.id === 'arrival')!
    expect(arrival.mutate).toBeDefined()
    const s: GameState = { ...base(), day: 6 }
    const before = s.units.length
    const res = arrival.mutate!(s)
    expect(res.state.units.length).toBe(before + 1)
    expect(res.effects.some((e) => e.target.startsWith('unit:'))).toBe(true)
  })

  it('ロスターが上限なら到着の重みは0', () => {
    const arrival = EVENTS.find((e) => e.id === 'arrival')!
    const full: GameState = {
      ...base(),
      day: 6,
      units: Array.from({ length: BALANCE.unit.cap }, (_, i) => ({
        ...base().units[0]!,
        id: `u${i}`,
      })),
    }
    expect(arrival.when({ state: full, flags: full.flags, day: 6 })).toBe(false)
  })

  it('加入済みのユニークは再び来ない（ランダムのみになる）', () => {
    const arrival = EVENTS.find((e) => e.id === 'arrival')!
    const s: GameState = {
      ...base(),
      day: 6,
      flags: { ...base().flags, joinedUniques: UNIQUE_UNITS.map((u) => u.id) },
    }
    for (let i = 0; i < 10; i++) {
      const res = arrival.mutate!({ ...s, rng: { seed: 700 + i, counter: 0 } })
      const added = res.state.units[res.state.units.length - 1]!
      expect(added.alias).toBeUndefined()
    }
  })

  it('once イベントは発火済みになると候補から外れる', () => {
    const s: GameState = {
      ...base(),
      day: 20,
      flags: { ...base().flags, fired: ['rescue_contact'] },
    }
    // 何回回しても rescue_contact の効果は出ない
    for (let i = 0; i < 20; i++) {
      const r = runEvents({ ...s, rng: { seed: 500 + i, counter: 0 } })
      expect(r.effects.some((e) => e.source === 'event:rescue_contact')).toBe(false)
    }
  })
})
