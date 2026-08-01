import { describe, expect, it } from 'vitest'
import {
  HISTORY_LIMIT,
  parseStore,
  serializeStore,
  storeReducer,
  type StoreState,
} from '../src/ui/store'
import { createInitialState } from '../src/game/state'
import { RANDOM_PORTRAIT_IDS } from '../src/game/data/units'
import type { DayPlan } from '../src/game/types'

const fresh = (): StoreState =>
  storeReducer({ state: createInitialState(1), history: [] }, { type: 'newGame', seed: 1 })

const roadPlan: DayPlan = {
  placements: [{ task: 'restore_road', unitIds: ['farmer'] }],
  ration: false,
}

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

describe('portrait normalization', () => {
  const pool = new Set<string>(RANDOM_PORTRAIT_IDS)

  function makeOldSave(): string {
    const s = fresh()
    const state = {
      ...s.state,
      units: [
        ...s.state.units,
        { ...s.state.units[0]!, id: 'recruit_5', name: 'テスト', portrait: 'recruit_5' },
        { ...s.state.units[0]!, id: 'recruit_8', name: 'テスト2', portrait: 'recruit_8' },
      ],
    }
    const history = [{ ...state, day: state.day - 1 }]
    return JSON.stringify({ version: 3, store: { state, history } })
  }

  it('旧 recruit_<counter> 肖像がプール内のIDに正規化される', () => {
    const parsed = parseStore(makeOldSave())
    expect(parsed).not.toBeNull()
    for (const unit of parsed!.state.units) {
      if (unit.id.startsWith('recruit_')) {
        expect(pool.has(unit.portrait)).toBe(true)
      }
    }
  })

  it('history の肖像も正規化される', () => {
    const parsed = parseStore(makeOldSave())
    expect(parsed).not.toBeNull()
    for (const snap of parsed!.history) {
      for (const unit of snap.units) {
        if (unit.id.startsWith('recruit_')) {
          expect(pool.has(unit.portrait)).toBe(true)
        }
      }
    }
  })

  it('同じセーブの正規化結果は決定的', () => {
    const json = makeOldSave()
    const a = parseStore(json)
    const b = parseStore(json)
    expect(a).toEqual(b)
  })

  it('同じユニットIDは state と history で同じ肖像を持つ', () => {
    const parsed = parseStore(makeOldSave())!
    const statePortraits = new Map(
      parsed.state.units.filter((u) => u.id.startsWith('recruit_')).map((u) => [u.id, u.portrait]),
    )
    for (const snap of parsed.history) {
      for (const unit of snap.units) {
        const expected = statePortraits.get(unit.id)
        if (expected) expect(unit.portrait).toBe(expected)
      }
    }
  })

  it('serialize → parse 後も正規化肖像が変わらない', () => {
    const parsed = parseStore(makeOldSave())!
    const reparsed = parseStore(serializeStore(parsed))
    expect(reparsed).toEqual(parsed)
  })
})
