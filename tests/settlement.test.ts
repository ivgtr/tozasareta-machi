import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { settle, type WorkEntry } from '../src/game/settlement'
import { BALANCE } from '../src/game/data/balance'
import type { GameState } from '../src/game/types'

const base = (): GameState => createInitialState(2)
const workedFarmer: WorkEntry[] = [{ unitId: 'farmer', task: 'restore_road' }]

describe('settlement', () => {
  it('食料はユニット数×単価だけ消費され、毎日減衰する', () => {
    const s = base()
    const { state } = settle(s, { ration: false, procure: false, worked: [] })
    expect(state.resources.food).toBe(
      s.resources.food - s.units.length * BALANCE.unit.foodPerUnit - BALANCE.food.decay,
    )
  })

  it('配給を絞ると消費が半分になる', () => {
    const s = base()
    const { state } = settle(s, { ration: true, procure: false, worked: [] })
    expect(state.resources.food).toBe(
      s.resources.food -
        Math.round((s.units.length * BALANCE.unit.foodPerUnit) / 2) -
        BALANCE.food.decay,
    )
    expect(state.flags.daysFoodCut).toBe(1)
  })

  it('食料も備蓄も尽きるとランダムな1ユニットが死亡する', () => {
    const s: GameState = { ...base(), resources: { ...base().resources, food: 0 }, stockpile: 0 }
    const before = s.units.length
    const { state } = settle(s, { ration: false, procure: false, worked: [] })
    expect(state.units.length).toBe(before - 1)
    expect(state.flags.casualties).toBe(1)
  })

  it('電力が安定していると予算収入にボーナスが乗る', () => {
    const s = base()
    const { state } = settle(s, { ration: false, procure: false, worked: [] })
    expect(state.budget).toBe(
      s.budget +
        BALANCE.budget.income +
        (s.resources.power >= BALANCE.budget.bonusAt ? BALANCE.budget.bonus : 0),
    )
  })

  it('医療が十分なら負傷が治る', () => {
    const s: GameState = {
      ...base(),
      resources: { ...base().resources, medical: 80 },
      units: base().units.map((u) =>
        u.id === 'engineer' ? { ...u, condition: 'injured' as const } : u,
      ),
    }
    const { state } = settle(s, { ration: false, procure: false, worked: [] })
    expect(state.units.find((u) => u.id === 'engineer')?.condition).toBe('healthy')
  })

  it('士気は毎日、基底減衰だけ減る', () => {
    const s: GameState = {
      ...base(),
      resources: { ...base().resources, morale: 60, food: 1000, power: 40, medical: 40 },
    }
    const { state } = settle(s, { ration: false, procure: false, worked: [] })
    expect(state.resources.morale).toBe(60 - BALANCE.morale.decay)
  })

  it('穏やかな日は基底減衰と calm が均衡して士気が変わらない', () => {
    const s: GameState = {
      ...base(),
      resources: { ...base().resources, morale: 60, food: 1000 },
    }
    const { state } = settle(s, { ration: false, procure: false, worked: [] })
    expect(state.resources.morale).toBe(60)
  })

  it('procure を指定すると予算を払って備蓄が増える', () => {
    const s = base()
    const { state } = settle(s, { ration: false, procure: true, worked: [] })
    const income =
      BALANCE.budget.income +
      (s.resources.power >= BALANCE.budget.bonusAt ? BALANCE.budget.bonus : 0)
    expect(state.budget).toBe(s.budget + income - BALANCE.procure.budget)
    expect(state.stockpile).toBe(s.stockpile + BALANCE.procure.stockpile)
  })

  it('予算が足りなければ procure は実行されない', () => {
    const s: GameState = {
      ...base(),
      budget: 0,
      modifiers: [
        {
          id: 'noincome',
          daysLeft: 1,
          startDay: 1,
          effects: [{ target: 'income:budget', op: 'set', value: 0 }],
        },
      ],
    }
    const { state } = settle(s, { ration: false, procure: true, worked: [] })
    expect(state.stockpile).toBe(s.stockpile)
    expect(state.budget).toBe(0)
  })

  it('頑丈なユニットは決して負傷しない', () => {
    for (let i = 0; i < 40; i++) {
      const s: GameState = {
        ...base(),
        resources: { food: 1000, power: 60, medical: 5, morale: 100 },
        rng: { seed: 100 + i, counter: 0 },
      }
      const r = settle(s, { ration: false, procure: false, worked: workedFarmer }).state // farmer は sturdy
      expect(r.units.find((u) => u.id === 'farmer')?.condition).toBe('healthy')
    }
  })

  it('医療不足では働くユニットがいずれ負傷する', () => {
    let injured = false
    for (let i = 0; i < 40 && !injured; i++) {
      const s: GameState = {
        ...base(),
        resources: { ...base().resources, medical: 5, food: 1000 },
        rng: { seed: 200 + i, counter: 0 },
        units: base().units.map((u) => ({ ...u, traits: u.traits.filter((t) => t !== 'sturdy') })),
      }
      const r = settle(s, { ration: false, procure: false, worked: workedFarmer }).state
      if (r.units.some((u) => u.condition === 'injured')) injured = true
    }
    expect(injured).toBe(true)
  })

  it('働くと成長し、閾値で適性が上がる', () => {
    let s: GameState = { ...base(), resources: { ...base().resources, food: 1000 } }
    const before = s.units.find((u) => u.id === 'farmer')!.apt.labor
    for (let i = 0; i < BALANCE.unit.growthThreshold; i++) {
      s = settle(s, { ration: false, procure: false, worked: workedFarmer }).state
    }
    const after = s.units.find((u) => u.id === 'farmer')!.apt.labor
    expect(after).toBe(before + 1)
  })

  it('士気が低いといずれ離脱が起きる', () => {
    let deserted = false
    for (let i = 0; i < 40 && !deserted; i++) {
      const s: GameState = {
        ...base(),
        resources: { ...base().resources, morale: 5, food: 1000 },
        rng: { seed: 300 + i, counter: 0 },
      }
      const r = settle(s, { ration: false, procure: false, worked: [] }).state
      if (r.units.length < s.units.length) deserted = true
    }
    expect(deserted).toBe(true)
  })
})
