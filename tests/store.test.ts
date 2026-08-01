import { describe, expect, it } from 'vitest'
import {
  HISTORY_LIMIT,
  parseStore,
  serializeStore,
  storeReducer,
  type StoreState,
} from '../src/ui/store'
import { createInitialState } from '../src/game/state'
import type { DayPlan } from '../src/game/types'

const fresh = (): StoreState =>
  storeReducer({ state: createInitialState(1), history: [] }, { type: 'newGame', seed: 1 })

const roadPlan: DayPlan = { assignments: [{ task: 'restore_road', workers: 2 }] }

describe('storeReducer', () => {
  it('newGame は初期状態と空の履歴を返す', () => {
    const s = fresh()
    expect(s.state.day).toBe(1)
    expect(s.history).toHaveLength(0)
  })

  it('commitDay で日が進み、直前状態が履歴に積まれる', () => {
    const s0 = fresh()
    const s1 = storeReducer(s0, { type: 'commitDay', plan: roadPlan })
    expect(s1.state.day).toBe(2)
    expect(s1.history).toHaveLength(1)
    expect(s1.history[0]).toEqual(s0.state)
  })

  it('undo で直前の日に戻る', () => {
    const s0 = fresh()
    const s1 = storeReducer(s0, { type: 'commitDay', plan: roadPlan })
    const s2 = storeReducer(s1, { type: 'undo' })
    expect(s2.state).toEqual(s0.state)
    expect(s2.history).toHaveLength(0)
  })

  it('空の履歴で undo しても変わらない', () => {
    const s0 = fresh()
    expect(storeReducer(s0, { type: 'undo' })).toBe(s0)
  })

  it('履歴は上限で頭打ちになる', () => {
    let s = fresh()
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      s = storeReducer(s, { type: 'commitDay', plan: roadPlan })
      if (s.state.phase === 'ended') break
    }
    expect(s.history.length).toBeLessThanOrEqual(HISTORY_LIMIT)
  })
})

describe('persistence', () => {
  it('serialize → parse で往復できる', () => {
    const s = fresh()
    const parsed = parseStore(serializeStore(s))
    expect(parsed).toEqual(s)
  })

  it('壊れた JSON は null', () => {
    expect(parseStore('{broken')).toBeNull()
  })

  it('version 不一致は null', () => {
    const s = fresh()
    const raw = JSON.parse(serializeStore(s)) as { version: number }
    raw.version = 999
    expect(parseStore(JSON.stringify(raw))).toBeNull()
  })

  it('必須フィールド欠損は null', () => {
    const s = fresh()
    const raw = JSON.parse(serializeStore(s)) as { store: { state: object } }
    // @ts-expect-error 意図的にフィールドを壊す
    delete raw.store.state.resources
    expect(parseStore(JSON.stringify(raw))).toBeNull()
  })
})
