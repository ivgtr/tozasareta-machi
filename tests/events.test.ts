import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { runEvents } from '../src/game/events'
import { EVENTS } from '../src/game/data/events-data'
import { BALANCE } from '../src/game/data/balance'
import type { GameState } from '../src/game/types'

const base = (): GameState => createInitialState(3)

describe('events', () => {
  it('同じ状態なら同じ結果（決定性）', () => {
    const s: GameState = { ...base(), day: 15 }
    expect(runEvents(s)).toEqual(runEvents(s))
  })

  it('避難者イベントはユニットを1人追加する（mutate）', () => {
    const refugees = EVENTS.find((e) => e.id === 'refugees')!
    expect(refugees.mutate).toBeDefined()
    const s: GameState = { ...base(), day: 6 }
    const before = s.units.length
    const res = refugees.mutate!(s)
    expect(res.state.units.length).toBe(before + 1)
    expect(res.effects.some((e) => e.source === 'event:refugees')).toBe(true)
  })

  it('ロスターが上限なら避難者の重みは0', () => {
    const refugees = EVENTS.find((e) => e.id === 'refugees')!
    const full: GameState = {
      ...base(),
      day: 6,
      units: Array.from({ length: BALANCE.unit.cap }, (_, i) => ({
        ...base().units[0]!,
        id: `u${i}`,
      })),
    }
    expect(refugees.weight({ state: full, flags: full.flags, day: 6 })).toBe(0)
  })

  it('ユニーク加入イベントは固定ユニットを増やす', () => {
    const eng = EVENTS.find((e) => e.id === 'stranded_engineer')!
    const s: GameState = { ...base(), day: 9 }
    const before = s.units.length
    const res = eng.mutate!(s)
    expect(res.state.units.length).toBe(before + 1)
    expect(res.state.units.some((u) => u.name === 'フランツ')).toBe(true)
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
