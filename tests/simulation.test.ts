import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { step } from '../src/game/engine'
import { BALANCE } from '../src/game/data/balance'
import { nextRandom } from '../src/game/rng'
import type { DayPlan, Ending, GameState, RngState, TaskId } from '../src/game/types'

const TASK_POOL: TaskId[] = ['repair_power', 'restore_road', 'reinforce_medical', 'soup_kitchen']
const TASK_COST: Record<string, { budget: number; stockpile: number }> = {
  repair_power: { budget: BALANCE.tasks.repair_power.budget, stockpile: 0 },
  restore_road: { budget: 0, stockpile: 0 },
  reinforce_medical: { budget: BALANCE.tasks.reinforce_medical.budget, stockpile: 0 },
  soup_kitchen: { budget: 0, stockpile: BALANCE.tasks.soup_kitchen.stockpile },
}

function randomPlan(state: GameState, rng: RngState): { plan: DayPlan; rng: RngState } {
  const assignments: DayPlan['assignments'] = []
  let r = rng
  let remaining = state.workers
  let budget = state.budget
  let stockpile = state.stockpile
  let attempts = 0
  while (remaining > 0 && attempts++ < 12) {
    const [v, r1] = nextRandom(r)
    r = r1
    const task = TASK_POOL[Math.floor(v * TASK_POOL.length)]
    if (task === undefined) continue
    const cost = TASK_COST[task]
    if (cost === undefined) continue
    if (budget < cost.budget || stockpile < cost.stockpile) continue
    const [wv, r2] = nextRandom(r)
    r = r2
    const w = 1 + Math.floor(wv * Math.min(2, remaining))
    if (w > remaining) continue
    remaining -= w
    budget -= cost.budget
    stockpile -= cost.stockpile
    assignments.push({ task, workers: w })
  }
  const [rv, r3] = nextRandom(r)
  r = r3
  if (rv < 0.15) assignments.push({ task: 'ration', workers: 0 })
  return { plan: { assignments }, rng: r }
}

function assertInvariants(s: GameState) {
  const nums = [
    s.resources.food,
    s.resources.power,
    s.resources.medical,
    s.resources.morale,
    s.budget,
    s.stockpile,
    s.workers,
    s.flags.casualties,
  ]
  for (const n of nums) expect(Number.isNaN(n)).toBe(false)
  expect(s.resources.morale).toBeGreaterThanOrEqual(0)
  expect(s.resources.morale).toBeLessThanOrEqual(100)
  expect(s.resources.power).toBeGreaterThanOrEqual(0)
  expect(s.resources.power).toBeLessThanOrEqual(100)
  expect(s.resources.medical).toBeGreaterThanOrEqual(0)
  expect(s.resources.medical).toBeLessThanOrEqual(100)
  expect(s.resources.food).toBeGreaterThanOrEqual(0)
  expect(s.budget).toBeGreaterThanOrEqual(0)
  expect(s.stockpile).toBeGreaterThanOrEqual(0)
  expect(s.flags.casualties).toBeGreaterThanOrEqual(0)
  expect(s.day).toBeLessThanOrEqual(BALANCE.days + 1)
  expect(new Set(s.flags.fired).size).toBe(s.flags.fired.length)
}

describe('simulation', () => {
  it('無作為プレイで不変条件が保たれ、必ず終了する', () => {
    const GAMES = 40
    const endings: Record<Ending, number> = {
      full_recovery: 0,
      managed_sacrifice: 0,
      self_governance: 0,
      collapse: 0,
    }
    for (let g = 0; g < GAMES; g++) {
      let s = createInitialState(1000 + g)
      let rng: RngState = { seed: 9000 + g, counter: 0 }
      let guard = 0
      while (s.phase === 'planning' && guard++ < 45) {
        const { plan, rng: next } = randomPlan(s, rng)
        rng = next
        s = step(s, { type: 'commitDay', plan }).state
        assertInvariants(s)
        if (s.phase === 'planning') expect(s.workers).toBeGreaterThanOrEqual(BALANCE.workers.min)
      }
      expect(s.phase).toBe('ended')
      expect(s.ending).toBeDefined()
      if (s.ending) endings[s.ending] += 1
    }
    const survived = GAMES - endings.collapse
    console.log(
      `[simulation] ${GAMES} games / survived ${survived} (${Math.round((survived / GAMES) * 100)}%)`,
      endings,
    )
  })
})
