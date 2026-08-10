import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import type { Ending, GameState } from '../src/game/types'
import { deriveEndingNarrative, deriveEndingPresentation } from '../src/scene/story/ending-model'
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

function withFlags(state: GameState, flags: Partial<GameState['flags']>): GameState {
  return { ...state, flags: { ...state.flags, ...flags } }
}

describe('deriveEndingPresentation', () => {
  it('エンディングごとに表示テーマと基調文を切り替える', () => {
    expect(deriveEndingPresentation(ended('full_recovery'))).toMatchObject({
      title: '完全復旧',
      accent: COLORS.green,
      narrative: { opening: '救援隊が山道を越えた朝、町にはまだ灯りが残っていた。' },
    })
    expect(deriveEndingPresentation(ended('managed_sacrifice'))).toMatchObject({
      title: '管理された犠牲',
      accent: COLORS.amber,
      narrative: { opening: '救援隊は、傷ついた町へたどり着いた。' },
    })
    expect(deriveEndingPresentation(ended('self_governance'))).toMatchObject({
      title: '住民自治',
      accent: COLORS.cyan,
      narrative: { opening: '復旧は遅れた。' },
    })
    expect(deriveEndingPresentation(ended('collapse'))).toMatchObject({
      title: '崩壊',
      accent: COLORS.red,
      narrative: { opening: '救援を待つ時間は、最後まで残されなかった。' },
    })
  })

  it('同じ完全復旧でも犠牲・協力・避難者受入で結末文を変える', () => {
    const base = ended('full_recovery')
    const plain = deriveEndingNarrative(withFlags(base, { casualties: 0, cooperation: 0 }))
    const cooperative = deriveEndingNarrative(
      withFlags(base, { casualties: 0, cooperation: 18, refugeesAccepted: 0 }),
    )
    const refugees = deriveEndingNarrative(
      withFlags(base, { casualties: 0, cooperation: 0, refugeesAccepted: 2 }),
    )
    const casualty = deriveEndingNarrative(
      withFlags(base, { casualties: 1, cooperation: 0, refugeesAccepted: 0 }),
    )

    expect(
      new Set([plain?.outcome, cooperative?.outcome, refugees?.outcome, casualty?.outcome]).size,
    ).toBe(4)
    expect(refugees?.outcome).toBe('避難者を受け入れながら、誰一人欠けずに30日を越えた。')
    expect(casualty?.outcome).toContain('失った仲間')
  })

  it('住民自治は協力と避難者受入を共同体の変化として語る', () => {
    const state = withFlags(ended('self_governance'), {
      cooperation: 24,
      refugeesAccepted: 3,
    })

    expect(deriveEndingNarrative(state)).toEqual({
      opening: '復旧は遅れた。',
      outcome: '避難者も輪に加わり、町は命令を待たず動ける共同体へ変わっていた。',
    })
  })

  it('崩壊時に生存者がいなくても短いエピローグを生成できる', () => {
    const state = ended('collapse', { units: [] })
    const model = deriveEndingPresentation(state)

    expect(model?.witness).toBeNull()
    expect(model?.narrative.outcome).toContain('指揮所に応える者はもういなかった')
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
    expect(`${model?.narrative.opening}${model?.narrative.outcome}`).not.toMatch(/42|82|77|70/)
  })

  it('endingが未確定ならNarrativeもPresentationも生成しない', () => {
    const state = createInitialState(1)
    expect(deriveEndingNarrative(state)).toBeNull()
    expect(deriveEndingPresentation(state)).toBeNull()
  })

  it('町長が不在なら在籍する人物を語り手に選ぶ', () => {
    const state = ended('managed_sacrifice')
    const units = state.units.filter((unit) => unit.id !== 'mayor')

    expect(deriveEndingPresentation({ ...state, units })?.witness?.id).toBe(units[0]?.id)
  })
})
