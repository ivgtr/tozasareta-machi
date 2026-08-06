import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { autoAssign, resolvePlacement, sanitizePlan } from '../src/game/actions'
import { BALANCE } from '../src/game/data/balance'
import type { GameState } from '../src/game/types'

const base = (): GameState => createInitialState(1)

const deltas = (
  state: GameState,
  task: Parameters<typeof resolvePlacement>[1]['task'],
  unitIds: string[],
) => resolvePlacement(state, { task, unitIds })

const sum = (fx: ReturnType<typeof resolvePlacement>, target: string) =>
  fx.filter((e) => e.target === target).reduce((s, e) => s + e.delta, 0)

describe('resolvePlacement（適性駆動）', () => {
  it('技術者を発電所に置くと電力が回復し予算を消費する', () => {
    const fx = deltas(base(), 'repair_power', ['engineer'])
    expect(sum(fx, 'power')).toBeGreaterThan(0)
    expect(sum(fx, 'budget')).toBe(-20)
  })

  it('農夫を道路に置くと食料が入る', () => {
    expect(sum(deltas(base(), 'restore_road', ['farmer']), 'food')).toBeGreaterThan(0)
  })

  it('適性が高いほど効果が大きい', () => {
    const high = sum(deltas(base(), 'repair_power', ['engineer']), 'power') // tech 9
    const low = sum(deltas(base(), 'repair_power', ['farmer']), 'power') // tech 3
    expect(high).toBeGreaterThan(low)
  })

  it('複数配置は合算される', () => {
    const one = sum(deltas(base(), 'restore_road', ['farmer']), 'food')
    const two = sum(deltas(base(), 'restore_road', ['farmer', 'engineer']), 'food')
    expect(two).toBeGreaterThan(one)
  })

  it('指導者と同じ任務の他ユニットは適性が底上げされる', () => {
    const mayorAlone = sum(deltas(base(), 'soup_kitchen', ['mayor']), 'morale')
    const withLeader = sum(deltas(base(), 'soup_kitchen', ['farmer', 'mayor']), 'morale')
    expect(withLeader).toBeGreaterThan(mayorAlone)
  })

  it('働き者は効果が増え、虚弱は減る', () => {
    const s = base()
    const plain = { ...s.units[3]!, id: 'p', traits: [] }
    const hard = { ...plain, id: 'h', traits: ['hard_worker' as const] }
    const frail = { ...plain, id: 'f', traits: ['frail' as const] }
    const st: GameState = { ...s, units: [plain, hard, frail] }
    const base_ = sum(resolvePlacement(st, { task: 'restore_road', unitIds: ['p'] }), 'food')
    const hardV = sum(resolvePlacement(st, { task: 'restore_road', unitIds: ['h'] }), 'food')
    const frailV = sum(resolvePlacement(st, { task: 'restore_road', unitIds: ['f'] }), 'food')
    expect(hardV).toBeGreaterThan(base_)
    expect(frailV).toBeLessThan(base_)
  })

  it('負傷中は効果が半減する', () => {
    const s = base()
    const healthy = sum(
      resolvePlacement(s, { task: 'repair_power', unitIds: ['engineer'] }),
      'power',
    )
    const injuredState: GameState = {
      ...s,
      units: s.units.map((u) =>
        u.id === 'engineer' ? { ...u, condition: 'injured' as const } : u,
      ),
    }
    const injured = sum(
      resolvePlacement(injuredState, { task: 'repair_power', unitIds: ['engineer'] }),
      'power',
    )
    expect(injured).toBeLessThan(healthy)
  })
})

describe('sanitizePlan', () => {
  it('同一ユニットの重複配置は除かれる', () => {
    const plan = sanitizePlan(base(), {
      placements: [
        { task: 'repair_power', unitIds: ['engineer'] },
        { task: 'restore_road', unitIds: ['engineer'] },
      ],
      ration: false,
      procure: false,
    })
    const count = plan.placements.reduce((s, p) => s + p.unitIds.length, 0)
    expect(count).toBe(1)
  })

  it('予算不足の任務は除かれる', () => {
    const poor: GameState = { ...base(), budget: 0 }
    const plan = sanitizePlan(poor, {
      placements: [{ task: 'repair_power', unitIds: ['engineer'] }],
      ration: false,
      procure: false,
    })
    expect(plan.placements).toHaveLength(0)
  })

  it('予算が足りなければ procure は取り下げられる', () => {
    const poor: GameState = { ...base(), budget: BALANCE.procure.budget - 1 }
    const plan = sanitizePlan(poor, { placements: [], ration: false, procure: true })
    expect(plan.procure).toBe(false)
  })

  it('任務コストを支払った残りで procure の可否が決まる', () => {
    const s: GameState = {
      ...base(),
      budget: BALANCE.tasks.repair_power.budget + BALANCE.procure.budget - 1,
    }
    const plan = sanitizePlan(s, {
      placements: [{ task: 'repair_power', unitIds: ['engineer'] }],
      ration: false,
      procure: true,
    })
    expect(plan.placements).toHaveLength(1)
    expect(plan.procure).toBe(false)
  })
})

describe('autoAssign', () => {
  it('全ユニットを重複なく配置する', () => {
    const s = base()
    const plan = autoAssign(s)
    const ids = plan.placements.flatMap((p) => p.unitIds)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(s.units.some((u) => u.id === id)).toBe(true)
    }
  })
})
