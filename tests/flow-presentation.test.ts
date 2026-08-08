import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import type { Effect } from '../src/game/types'
import { deriveFlowPresentation } from '../src/scene/playback/flow-model'
import type { FlowBeat } from '../src/scene/playback/beats'

function flowBeat(source: string, actorIds: string[], effects: Effect[]): FlowBeat {
  return { kind: 'flow', source, actorIds, effects }
}

describe('deriveFlowPresentation', () => {
  it('タスクの担当人物・施設・主要成果を一つの行動表示へまとめる', () => {
    const state = createInitialState(1)
    const actor = state.units[0]!
    const beat = flowBeat(
      'task:repair_power',
      [actor.id],
      [
        {
          day: 1,
          source: 'task:repair_power',
          target: 'budget',
          delta: -10,
          reason: '予算を使った',
        },
        {
          day: 1,
          source: 'task:repair_power',
          target: 'power',
          delta: 18,
          reason: '発電設備を修理し、電力が回復した',
        },
      ],
    )

    const model = deriveFlowPresentation(beat, state)
    expect(model.title).toBe('発電所の修理')
    expect(model.kicker).toBe(actor.name)
    expect(model.primaryActor?.id).toBe(actor.id)
    expect(model.facility).toBe('power')
    expect(model.tone).toBe('positive')
    expect(model.deltas).toEqual([
      { target: 'budget', label: '予算', delta: -10, tone: 'negative' },
      { target: 'power', label: '電力', delta: 18, tone: 'positive' },
    ])
  })

  it('同じ資源への複数効果は表示上合算する', () => {
    const state = createInitialState(1)
    const beat = flowBeat(
      'settlement',
      [],
      [
        { day: 1, source: 'settlement', target: 'food', delta: -3, reason: '消費' },
        { day: 1, source: 'settlement', target: 'food', delta: -2, reason: '減衰' },
      ],
    )

    const model = deriveFlowPresentation(beat, state)
    expect(model.title).toBe('一日の清算')
    expect(model.kicker).toBe('日次報告')
    expect(model.tone).toBe('negative')
    expect(model.deltas).toEqual([{ target: 'food', label: '食料', delta: -5, tone: 'negative' }])
  })

  it('増減が混在する日次清算は中立として扱う', () => {
    const state = createInitialState(1)
    const beat = flowBeat(
      'settlement',
      [],
      [
        { day: 1, source: 'settlement', target: 'food', delta: -5, reason: '消費' },
        { day: 1, source: 'settlement', target: 'budget', delta: 2, reason: '収入' },
      ],
    )

    expect(deriveFlowPresentation(beat, state).tone).toBe('neutral')
  })
})
