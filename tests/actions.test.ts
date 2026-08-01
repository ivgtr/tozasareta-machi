import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { preview, resolveAssignment, sanitizePlan } from '../src/game/actions'
import type { GameState } from '../src/game/types'

const base = (): GameState => createInitialState(1)

const delta = (effects: ReturnType<typeof resolveAssignment>, target: string) =>
  effects.filter((e) => e.target === target).reduce((sum, e) => sum + e.delta, 0)

describe('actions', () => {
  it('repair_power は予算を消費し電力を回復する', () => {
    const fx = resolveAssignment(base(), { task: 'repair_power', workers: 2 })
    expect(delta(fx, 'budget')).toBe(-20)
    expect(delta(fx, 'power')).toBeGreaterThan(0)
  })

  it('repair_power は技術者を割くと効果が増える', () => {
    const plain = resolveAssignment(base(), { task: 'repair_power', workers: 2 })
    const boosted = resolveAssignment(base(), {
      task: 'repair_power',
      workers: 2,
      characterId: 'engineer',
    })
    expect(delta(boosted, 'power')).toBeGreaterThan(delta(plain, 'power'))
  })

  it('restore_road は作業員数に比例して食料と備蓄を搬入する', () => {
    const w1 = resolveAssignment(base(), { task: 'restore_road', workers: 1 })
    const w3 = resolveAssignment(base(), { task: 'restore_road', workers: 3 })
    expect(delta(w3, 'food')).toBe(delta(w1, 'food') * 3)
    expect(delta(w1, 'stockpile')).toBeGreaterThan(0)
  })

  it('reinforce_medical は低電力で効率が落ちる', () => {
    const low: GameState = { ...base(), resources: { ...base().resources, power: 10 } }
    const full = resolveAssignment(base(), { task: 'reinforce_medical', workers: 2 })
    const weak = resolveAssignment(low, { task: 'reinforce_medical', workers: 2 })
    expect(delta(weak, 'medical')).toBeLessThan(delta(full, 'medical'))
  })

  it('soup_kitchen は備蓄を消費し士気を回復する', () => {
    const fx = resolveAssignment(base(), { task: 'soup_kitchen', workers: 1 })
    expect(delta(fx, 'stockpile')).toBe(-15)
    expect(delta(fx, 'morale')).toBeGreaterThan(0)
  })
})

describe('sanitizePlan', () => {
  it('作業員総数を超える割り当ては除かれる', () => {
    const plan = sanitizePlan(base(), {
      assignments: [
        { task: 'restore_road', workers: 4 },
        { task: 'repair_power', workers: 4 },
      ],
    })
    const total = plan.assignments.reduce((s, a) => s + a.workers, 0)
    expect(total).toBeLessThanOrEqual(base().workers)
  })

  it('予算不足の任務は除かれる', () => {
    const poor: GameState = { ...base(), budget: 5 }
    const plan = sanitizePlan(poor, { assignments: [{ task: 'repair_power', workers: 1 }] })
    expect(plan.assignments).toHaveLength(0)
  })

  it('同一人物の重複割り当ては除かれる', () => {
    const plan = sanitizePlan(base(), {
      assignments: [
        { task: 'repair_power', workers: 1, characterId: 'engineer' },
        { task: 'reinforce_medical', workers: 1, characterId: 'engineer' },
      ],
    })
    expect(plan.assignments).toHaveLength(1)
  })
})

describe('preview', () => {
  it('配給を絞ると食料温存と士気減の見込みを返す', () => {
    const fx = preview(base(), { assignments: [{ task: 'ration', workers: 0 }] })
    expect(delta(fx, 'food')).toBeGreaterThan(0)
    expect(delta(fx, 'morale')).toBeLessThan(0)
  })
})
