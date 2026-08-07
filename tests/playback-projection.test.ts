import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { projectPlaybackState } from '../src/scene/playback/project-state'
import type { Effect } from '../src/game/types'

function withUnitChange(effect: Effect, unitChanges: NonNullable<Effect['unitChanges']>): Effect {
  return { ...effect, unitChanges }
}

describe('projectPlaybackState', () => {
  it('削除契約が再生された時点でユニットを表示stateから除外する', () => {
    const previous = createInitialState(1)
    const dead = previous.units[0]!
    const effect = withUnitChange(
      {
        day: previous.day,
        source: 'settlement',
        target: 'flag:casualties',
        delta: 1,
        reason: '犠牲者が出た',
      },
      [{ kind: 'remove', unitId: dead.id }],
    )

    const projected = projectPlaybackState(previous, [effect])
    expect(projected.units.some((unit) => unit.id === dead.id)).toBe(false)
    expect(projected.flags.casualties).toBe(previous.flags.casualties + 1)
  })

  it('負傷と治療をEffectの順序どおりに投影し、未来の状態を先取りしない', () => {
    const previous = createInitialState(1)
    const target = previous.units[0]!
    const injured = { ...target, condition: 'injured' as const }
    const healthy = { ...injured, condition: 'healthy' as const }
    const injury = withUnitChange(
      {
        day: previous.day,
        source: 'event:expedition_return',
        target: 'flag:injury',
        delta: 0,
        reason: '探索で負傷した',
      },
      [{ kind: 'sync', unit: injured }],
    )
    const heal = withUnitChange(
      {
        day: previous.day,
        source: 'settlement',
        target: 'flag:heal',
        delta: 0,
        reason: '治療した',
      },
      [{ kind: 'sync', unit: healthy }],
    )

    expect(
      projectPlaybackState(previous, [injury]).units.find((unit) => unit.id === target.id)
        ?.condition,
    ).toBe('injured')
    expect(
      projectPlaybackState(previous, [injury, heal]).units.find((unit) => unit.id === target.id)
        ?.condition,
    ).toBe('healthy')
  })

  it('人物名をreasonへ含めなくても同期契約から新規加入ユニットを追加する', () => {
    const previous = createInitialState(1)
    const newcomer = { ...previous.units[0]!, id: 'newcomer', name: '新参者' }
    const effect = withUnitChange(
      {
        day: previous.day,
        source: 'event:arrival',
        target: 'unit:newcomer',
        delta: 0,
        reason: '新たな仲間が到着した',
      },
      [{ kind: 'sync', unit: newcomer }],
    )

    const projected = projectPlaybackState(previous, [effect])
    expect(projected.units.some((unit) => unit.id === newcomer.id)).toBe(true)
  })
})
