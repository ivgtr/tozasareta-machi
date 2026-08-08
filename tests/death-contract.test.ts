import { describe, expect, it } from 'vitest'
import { DEATH_SOURCES } from '../src/game/death'
import { BALANCE } from '../src/game/data/balance'
import { settle } from '../src/game/settlement'
import { createInitialState } from '../src/game/state'
import type { Effect, GameState } from '../src/game/types'
import { deriveBeatImportance } from '../src/scene/playback/beat-presentation'
import { buildBeats } from '../src/scene/playback/beats'
import { buildPlaybackEffects } from '../src/scene/playback/contract'

function starvationState(): GameState {
  const state = createInitialState(2)
  return { ...state, resources: { ...state.resources, food: 0 }, stockpile: 0 }
}

describe('unit death contract', () => {
  it('飢餓死を人物ターゲット付きの明示的な死亡Effectとして記録する', () => {
    const previous = starvationState()
    const result = settle(previous, { ration: false, procure: false, worked: [] })
    const dead = previous.units.find(
      (unit) => !result.state.units.some((candidate) => candidate.id === unit.id),
    )

    expect(dead).toBeDefined()
    const deathEffects = result.effects.filter(
      (effect) => effect.source === DEATH_SOURCES.starvation,
    )
    expect(deathEffects).toContainEqual(
      expect.objectContaining({ target: `unit:${dead!.id}`, delta: 0 }),
    )
    expect(deathEffects).toContainEqual(
      expect.objectContaining({ target: 'flag:casualties', delta: 1 }),
    )
  })

  it('死亡removeを当該Effectへ結び付け、portraitを保持したdeath beatへ変換する', () => {
    const previous = starvationState()
    const result = settle(previous, { ration: false, procure: false, worked: [] })
    const playback = buildPlaybackEffects(previous, result.state, result.effects)
    const death = buildBeats(playback).find((beat) => beat.kind === 'death')

    expect(death?.kind).toBe('death')
    if (death?.kind !== 'death') return
    expect(death.cause).toBe('starvation')
    expect(previous.units.some((unit) => unit.id === death.unit.id)).toBe(true)
    expect(result.state.units.some((unit) => unit.id === death.unit.id)).toBe(false)
    expect(
      death.effects.some((effect) =>
        effect.unitChanges?.some((change) => change.kind === 'remove'),
      ),
    ).toBe(true)
    expect(deriveBeatImportance(death)).toBe('major')
  })

  it('探索死も同じdeath beat契約へ収束する', () => {
    let found = false
    for (let seed = 1; seed <= 1200 && !found; seed++) {
      const base = createInitialState(seed)
      const previous: GameState = {
        ...base,
        day: 12,
        resources: { ...base.resources, food: 1000 },
        units: base.units.map((unit) => (unit.id === 'farmer' ? { ...unit, expedition: 1 } : unit)),
      }
      const result = settle(previous, { ration: false, procure: false, worked: [] })
      if (!result.effects.some((effect) => effect.source === DEATH_SOURCES.expedition)) continue

      const death = buildBeats(buildPlaybackEffects(previous, result.state, result.effects)).find(
        (beat) => beat.kind === 'death',
      )
      expect(death?.kind).toBe('death')
      if (death?.kind === 'death') expect(death.cause).toBe('expedition')
      found = true
    }
    expect(found).toBe(true)
  })

  it('単なる退場removeを死亡として扱わない', () => {
    const previous = createInitialState(3)
    const left = previous.units[0]!
    const final = { ...previous, units: previous.units.slice(1) }
    const effects: Effect[] = [
      {
        day: 1,
        source: 'settlement',
        target: 'flag:desert',
        delta: 0,
        reason: `${left.name}が町を去った`,
      },
    ]
    const beats = buildBeats(buildPlaybackEffects(previous, final, effects))

    expect(beats).toHaveLength(1)
    expect(beats[0]?.kind).toBe('flow')
    expect(deriveBeatImportance(beats[0]!)).toBe('minor')
  })

  it('探索死亡の確率設定自体は変更しない', () => {
    expect(BALANCE.expedition.deathShare).toBeGreaterThan(0)
  })
})
