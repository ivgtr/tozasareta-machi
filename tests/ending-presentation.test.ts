import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import type { Ending, GameState } from '../src/game/types'
import { deriveEndingPresentation } from '../src/scene/story/ending-model'
import { COLORS } from '../src/scene/tokens'

function ended(ending: Ending, patch: Partial<GameState> = {}): GameState {
  const initial = createInitialState(1)
  return {
    ...initial,
    ...patch,
    phase: 'ended',
    ending,
  }
}

describe('deriveEndingPresentation', () => {
  it('エンディングごとに表示テーマを切り替える', () => {
    expect(deriveEndingPresentation(ended('full_recovery'))).toMatchObject({
      title: '完全復旧',
      accent: COLORS.green,
    })
    expect(deriveEndingPresentation(ended('managed_sacrifice'))).toMatchObject({
      title: '管理された犠牲',
      accent: COLORS.amber,
    })
    expect(deriveEndingPresentation(ended('self_governance'))).toMatchObject({
      title: '住民自治',
      accent: COLORS.cyan,
    })
    expect(deriveEndingPresentation(ended('collapse'))).toMatchObject({
      title: '崩壊',
      accent: COLORS.red,
    })
  })

  it('最終資源と30日間の記録をそのまま表示モデルへ投影する', () => {
    const state = ended('full_recovery', {
      day: 31,
      resources: { food: 42.4, power: 81.6, medical: 77.2, morale: 69.8 },
      budget: 7,
      stockpile: 11,
      flags: {
        ...createInitialState(1).flags,
        casualties: 2,
        cooperation: 9,
        refugeesAccepted: 3,
      },
    })
    const model = deriveEndingPresentation(state)

    expect(model?.reachedDay).toBe(30)
    expect(model?.witness?.id).toBe('mayor')
    expect(model?.resources).toEqual([
      { label: '食料', value: 42 },
      { label: '電力', value: 82 },
      { label: '医療', value: 77 },
      { label: '士気', value: 70 },
    ])
    expect(model?.records).toContainEqual({ label: '犠牲者', value: 2 })
    expect(model?.records).toContainEqual({ label: '協力', value: 9 })
    expect(model?.records).toContainEqual({ label: '受入', value: 3 })
    expect(model?.records).toContainEqual({ label: '予算', value: 7 })
    expect(model?.records).toContainEqual({ label: '備蓄', value: 11 })
  })

  it('endingが未確定ならPresentationを生成しない', () => {
    expect(deriveEndingPresentation(createInitialState(1))).toBeNull()
  })

  it('町長が不在なら在籍する人物を語り手に選ぶ', () => {
    const state = ended('managed_sacrifice')
    const units = state.units.filter((unit) => unit.id !== 'mayor')

    expect(deriveEndingPresentation({ ...state, units })?.witness?.id).toBe(units[0]?.id)
  })
})
