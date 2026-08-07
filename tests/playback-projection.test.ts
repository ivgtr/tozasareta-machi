import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { projectPlaybackState } from '../src/scene/playback/project-state'
import type { Effect, GameState } from '../src/game/types'

describe('projectPlaybackState', () => {
  it('死亡通知が再生された時点でユニットを表示stateから除外する', () => {
    const previous = createInitialState(1)
    const dead = previous.units[0]!
    const final: GameState = {
      ...previous,
      units: previous.units.slice(1),
      flags: { ...previous.flags, casualties: previous.flags.casualties + 1 },
    }
    const effect: Effect = {
      day: previous.day,
      source: 'settlement',
      target: 'flag:casualties',
      delta: 1,
      reason: `食料が尽き、${dead.name}が亡くなった`,
    }

    const projected = projectPlaybackState(previous, final, [effect])
    expect(projected.units.some((unit) => unit.id === dead.id)).toBe(false)
    expect(projected.flags.casualties).toBe(final.flags.casualties)
  })

  it('負傷通知が再生されるまでは元の状態を保ち、再生後に確定状態へ同期する', () => {
    const previous = createInitialState(1)
    const target = previous.units[0]!
    const final: GameState = {
      ...previous,
      units: previous.units.map((unit) =>
        unit.id === target.id ? { ...unit, condition: 'injured' as const } : unit,
      ),
    }
    const unrelated: Effect = {
      day: previous.day,
      source: 'settlement',
      target: 'food',
      delta: -1,
      reason: '食料を消費した',
    }
    const injury: Effect = {
      day: previous.day,
      source: 'settlement',
      target: 'flag:injury',
      delta: 0,
      reason: `${target.name}が怪我を負った（効果半減）`,
    }

    expect(
      projectPlaybackState(previous, final, [unrelated]).units.find((unit) => unit.id === target.id)
        ?.condition,
    ).toBe('healthy')
    expect(
      projectPlaybackState(previous, final, [unrelated, injury]).units.find(
        (unit) => unit.id === target.id,
      )?.condition,
    ).toBe('injured')
  })

  it('unit通知が再生された時点で新規加入ユニットを表示stateへ追加する', () => {
    const previous = createInitialState(1)
    const newcomer = { ...previous.units[0]!, id: 'newcomer', name: '新参者' }
    const final: GameState = { ...previous, units: [...previous.units, newcomer] }
    const effect: Effect = {
      day: previous.day,
      source: 'event:arrival',
      target: 'unit:newcomer',
      delta: 0,
      reason: '新参者が町に辿り着いた',
    }

    const projected = projectPlaybackState(previous, final, [effect])
    expect(projected.units.some((unit) => unit.id === newcomer.id)).toBe(true)
  })
})
