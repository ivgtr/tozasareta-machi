import { describe, expect, it } from 'vitest'
import {
  addModifier,
  isTaskDisabled,
  queryAdd,
  queryMult,
  tickModifiers,
} from '../src/game/modifiers'
import { createInitialState } from '../src/game/state'
import { settle } from '../src/game/settlement'
import { autoAssign, placementValue, sanitizePlan } from '../src/game/actions'
import { step } from '../src/game/engine'
import { BALANCE } from '../src/game/data/balance'
import type { DayPlan, GameState, Modifier } from '../src/game/types'

const mod = (
  id: string,
  daysLeft: number,
  startDay: number,
  effects: Modifier['effects'],
): Modifier => ({
  id,
  daysLeft,
  startDay,
  effects,
})

describe('queryMult', () => {
  it('modifier がなければ 1 を返す', () => {
    expect(queryMult([], 'consume:food')).toBe(1)
  })

  it('mult を乗算する', () => {
    const mods = [
      mod('a', 2, 1, [{ target: 'produce:all', op: 'mult', value: 1.3 }]),
      mod('b', 2, 1, [{ target: 'produce:all', op: 'mult', value: 0.7 }]),
    ]
    expect(queryMult(mods, 'produce:all')).toBeCloseTo(0.91)
  })

  it('set は即座に優先される', () => {
    const mods = [
      mod('a', 2, 1, [{ target: 'produce:repair_power', op: 'mult', value: 1.5 }]),
      mod('b', 2, 1, [{ target: 'produce:repair_power', op: 'set', value: 0 }]),
    ]
    expect(queryMult(mods, 'produce:repair_power')).toBe(0)
  })

  it('異なる target には干渉しない', () => {
    const mods = [mod('a', 2, 1, [{ target: 'decay:power', op: 'mult', value: 1.5 }])]
    expect(queryMult(mods, 'consume:food')).toBe(1)
  })
})

describe('queryAdd', () => {
  it('add を加算する', () => {
    const mods = [
      mod('a', 3, 1, [{ target: 'drain:stockpile', op: 'add', value: -10 }]),
      mod('b', 3, 1, [{ target: 'drain:stockpile', op: 'add', value: -5 }]),
    ]
    expect(queryAdd(mods, 'drain:stockpile')).toBe(-15)
  })

  it('mult/set は無視する', () => {
    const mods = [mod('a', 3, 1, [{ target: 'drain:stockpile', op: 'mult', value: 2 }])]
    expect(queryAdd(mods, 'drain:stockpile')).toBe(0)
  })
})

describe('isTaskDisabled', () => {
  it('set 0 で disabled', () => {
    const mods = [mod('typhoon', 2, 1, [{ target: 'produce:repair_power', op: 'set', value: 0 }])]
    expect(isTaskDisabled(mods, 'repair_power')).toBe(true)
    expect(isTaskDisabled(mods, 'restore_road')).toBe(false)
  })
})

describe('tickModifiers', () => {
  it('startDay と同じ日ではデクリメントしない', () => {
    const mods = [mod('a', 2, 5, [{ target: 'consume:food', op: 'set', value: 0 }])]
    const result = tickModifiers(mods, 5)
    expect(result).toHaveLength(1)
    expect(result[0]!.daysLeft).toBe(2)
  })

  it('startDay の翌日からデクリメントする', () => {
    const mods = [mod('a', 2, 5, [{ target: 'consume:food', op: 'set', value: 0 }])]
    const d6 = tickModifiers(mods, 6)
    expect(d6[0]!.daysLeft).toBe(1)
    const d7 = tickModifiers(d6, 7)
    expect(d7).toHaveLength(0)
  })
})

describe('addModifier', () => {
  it('新規追加', () => {
    const m = mod('a', 2, 1, [])
    expect(addModifier([], m)).toEqual([m])
  })

  it('同一 id は上書き（延長）', () => {
    const old = mod('a', 1, 1, [{ target: 'consume:food', op: 'set', value: 0 }])
    const renewed = mod('a', 3, 5, [{ target: 'consume:food', op: 'set', value: 0 }])
    const result = addModifier([old], renewed)
    expect(result).toHaveLength(1)
    expect(result[0]!.daysLeft).toBe(3)
    expect(result[0]!.startDay).toBe(5)
  })
})

describe('settlement との統合', () => {
  const base = (): GameState => createInitialState(2)

  it('consume:food set 0 で食料消費がなくなる', () => {
    const s: GameState = {
      ...base(),
      modifiers: [mod('manna', 3, 1, [{ target: 'consume:food', op: 'set', value: 0 }])],
    }
    const { state } = settle(s, { ration: false, worked: [] })
    expect(state.resources.food).toBe(s.resources.food)
  })

  it('decay:power mult 1.5 で電力減衰が増える', () => {
    const s: GameState = {
      ...base(),
      modifiers: [mod('cold', 3, 1, [{ target: 'decay:power', op: 'mult', value: 1.5 }])],
    }
    const { state } = settle(s, { ration: false, worked: [] })
    const expected = s.resources.power - Math.round(BALANCE.power.decay * 1.5)
    expect(state.resources.power).toBe(Math.max(0, expected))
  })

  it('drain:stockpile add -10 で備蓄が減る', () => {
    const s: GameState = {
      ...base(),
      modifiers: [mod('rats', 3, 1, [{ target: 'drain:stockpile', op: 'add', value: -10 }])],
    }
    const { state } = settle(s, { ration: false, worked: [] })
    expect(state.stockpile).toBe(s.stockpile - 10)
  })

  it('income:budget mult 0.5 で予算収入が半減する', () => {
    const s: GameState = {
      ...base(),
      modifiers: [mod('half', 2, 1, [{ target: 'income:budget', op: 'mult', value: 0.5 }])],
    }
    const { state } = settle(s, { ration: false, worked: [] })
    const bonus = s.resources.power >= BALANCE.budget.bonusAt ? BALANCE.budget.bonus : 0
    const expected = s.budget + Math.round((BALANCE.budget.income + bonus) * 0.5)
    expect(state.budget).toBe(expected)
  })
})

describe('actions との統合', () => {
  it('produce set 0 の任務は sanitizePlan で除去される', () => {
    const s: GameState = {
      ...createInitialState(5),
      modifiers: [mod('typhoon', 2, 1, [{ target: 'produce:repair_power', op: 'set', value: 0 }])],
    }
    const plan: DayPlan = {
      placements: [
        { task: 'repair_power', unitIds: ['engineer'] },
        { task: 'restore_road', unitIds: ['farmer'] },
      ],
      ration: false,
    }
    const clean = sanitizePlan(s, plan)
    expect(clean.placements.map((p) => p.task)).toEqual(['restore_road'])
  })

  it('produce:all mult 1.3 で全任務の産出が増える', () => {
    const s: GameState = {
      ...createInitialState(5),
      modifiers: [mod('surge', 2, 1, [{ target: 'produce:all', op: 'mult', value: 1.3 }])],
    }
    const plain = createInitialState(5)
    const boosted = placementValue(s, { task: 'restore_road', unitIds: ['farmer'] })
    const normal = placementValue(plain, { task: 'restore_road', unitIds: ['farmer'] })
    expect(boosted).toBe(Math.round(normal * 1.3))
  })

  it('autoAssign は disabled な任務を避ける', () => {
    const s: GameState = {
      ...createInitialState(5),
      modifiers: [
        mod('typhoon', 2, 1, [
          { target: 'produce:repair_power', op: 'set', value: 0 },
          { target: 'produce:restore_road', op: 'set', value: 0 },
        ]),
      ],
    }
    const plan = autoAssign(s)
    const tasks = plan.placements.map((p) => p.task)
    expect(tasks).not.toContain('repair_power')
    expect(tasks).not.toContain('restore_road')
  })
})

describe('engine との統合', () => {
  const idle: DayPlan = { placements: [], ration: false }

  it('modifier は startDay 当日はデクリメントされず、翌日から減る', () => {
    const s: GameState = {
      ...createInitialState(5),
      modifiers: [mod('test', 2, 1, [{ target: 'consume:food', op: 'set', value: 0 }])],
    }
    const { state } = step(s, { type: 'commitDay', plan: idle })
    expect(state.modifiers).toHaveLength(1)
    expect(state.modifiers[0]!.daysLeft).toBe(2)
    const { state: s2 } = step(state, { type: 'commitDay', plan: idle })
    expect(s2.modifiers[0]!.daysLeft).toBe(1)
    const { state: s3 } = step(s2, { type: 'commitDay', plan: idle })
    expect(s3.modifiers).toHaveLength(0)
  })

  it('modifier 込みで決定性が保たれる', () => {
    const run = (seed: number) => {
      let s: GameState = {
        ...createInitialState(seed),
        modifiers: [mod('manna', 3, 1, [{ target: 'consume:food', op: 'set', value: 0 }])],
      }
      let guard = 0
      while (s.phase !== 'ended' && guard++ < 80) {
        if (s.phase === 'planning') {
          s = step(s, { type: 'commitDay', plan: autoAssign(s) }).state
        } else if (s.phase === 'choice') {
          const optionId = s.pendingChoice?.optionIds[0] ?? ''
          s = step(s, { type: 'resolveChoice', optionId }).state
        } else break
      }
      return s
    }
    expect(run(999)).toEqual(run(999))
  })
})
