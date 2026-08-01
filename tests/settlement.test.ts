import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { settle } from '../src/game/settlement'
import { BALANCE } from '../src/game/data/balance'
import type { GameState } from '../src/game/types'

const base = (): GameState => createInitialState(2)
const delta = (s: GameState, key: 'food' | 'power' | 'medical' | 'morale') => s.resources[key]

describe('settlement', () => {
  it('電力が安定していると予算収入にボーナスが乗る', () => {
    const { state } = settle(base(), false)
    expect(state.budget).toBe(BALANCE.budget.start + BALANCE.budget.income + BALANCE.budget.bonus)
  })

  it('毎日食料を消費する', () => {
    const { state } = settle(base(), false)
    expect(state.resources.food).toBe(BALANCE.food.start - BALANCE.food.consume)
  })

  it('配給を絞ると消費が半分になり士気が下がる', () => {
    const { state, effects } = settle(base(), true)
    expect(state.resources.food).toBe(BALANCE.food.start - BALANCE.food.consume / 2)
    expect(state.flags.daysFoodCut).toBe(1)
    expect(effects.some((e) => e.target === 'morale' && e.delta < 0)).toBe(true)
  })

  it('食料が尽きるとまず備蓄を取り崩す', () => {
    const s: GameState = { ...base(), resources: { ...base().resources, food: 5 } }
    const { state } = settle(s, false)
    expect(state.resources.food).toBe(0)
    expect(state.stockpile).toBeLessThan(BALANCE.stockpile.start)
    expect(state.flags.casualties).toBe(0)
  })

  it('食料も備蓄も尽きると犠牲が出て士気が大きく下がる', () => {
    const s: GameState = {
      ...base(),
      resources: { ...base().resources, food: 0 },
      stockpile: 0,
    }
    const before = s.resources.morale
    const { state } = settle(s, false)
    expect(state.flags.casualties).toBeGreaterThan(0)
    expect(state.resources.morale).toBeLessThan(before)
  })

  it('電力と医療は毎日減衰する', () => {
    const { state } = settle(base(), false)
    expect(delta(state, 'power')).toBe(BALANCE.power.start - BALANCE.power.decay)
    expect(delta(state, 'medical')).toBe(BALANCE.medical.start - BALANCE.medical.decay)
  })

  it('医療が低いと放置日数が増える', () => {
    const s: GameState = { ...base(), resources: { ...base().resources, medical: 10 } }
    const { state } = settle(s, false)
    expect(state.flags.daysWithoutMedical).toBe(1)
  })

  it('士気が暴動閾値を下回ると予算を失う', () => {
    const s: GameState = { ...base(), resources: { ...base().resources, morale: 10, food: 100 } }
    const { state } = settle(s, false)
    expect(state.resources.morale).toBeLessThan(BALANCE.morale.riotAt)
    expect(state.budget).toBeLessThanOrEqual(
      BALANCE.budget.start + BALANCE.budget.income + BALANCE.budget.bonus,
    )
  })
})
