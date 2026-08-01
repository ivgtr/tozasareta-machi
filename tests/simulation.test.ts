import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { step } from '../src/game/engine'
import { PHYSICAL_TASKS, autoAssign, taskCost } from '../src/game/actions'
import { nextRandom } from '../src/game/rng'
import type { DayPlan, Ending, GameState, RngState, TaskId } from '../src/game/types'

function shuffle<T>(arr: T[], rng: RngState): { list: T[]; rng: RngState } {
  const list = [...arr]
  let r = rng
  for (let i = list.length - 1; i > 0; i--) {
    const [v, rr] = nextRandom(r)
    r = rr
    const j = Math.floor(v * (i + 1))
    const tmp = list[i] as T
    list[i] = list[j] as T
    list[j] = tmp
  }
  return { list, rng: r }
}

function randomPlan(state: GameState, rng: RngState): { plan: DayPlan; rng: RngState } {
  const { list, rng: r0 } = shuffle(state.units, rng)
  let r = r0
  let budget = state.budget
  let stockpile = state.stockpile
  const buckets: Record<TaskId, string[]> = {
    repair_power: [],
    restore_road: [],
    reinforce_medical: [],
    soup_kitchen: [],
    ration: [],
  }
  for (const u of list) {
    const [tv, r1] = nextRandom(r)
    r = r1
    const t = PHYSICAL_TASKS[Math.floor(tv * PHYSICAL_TASKS.length)] ?? 'restore_road'
    const cost = taskCost(t)
    const firstIn = buckets[t].length === 0
    if (firstIn && (budget < cost.budget || stockpile < cost.stockpile)) continue
    if (firstIn) {
      budget -= cost.budget
      stockpile -= cost.stockpile
    }
    buckets[t].push(u.id)
  }
  const [rv, r2] = nextRandom(r)
  r = r2
  const placements = PHYSICAL_TASKS.filter((t) => buckets[t].length > 0).map((t) => ({
    task: t,
    unitIds: buckets[t],
  }))
  return { plan: { placements, ration: rv < 0.15 }, rng: r }
}

function assertInvariants(s: GameState) {
  const nums = [
    s.resources.food,
    s.resources.power,
    s.resources.medical,
    s.resources.morale,
    s.budget,
    s.stockpile,
    s.flags.casualties,
    s.units.length,
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
  expect(s.units.length).toBeGreaterThanOrEqual(0)
  expect(s.day).toBeLessThanOrEqual(31)
  expect(new Set(s.flags.fired).size).toBe(s.flags.fired.length)
}

type Strategy = (state: GameState, rng: RngState) => { plan: DayPlan; rng: RngState }

function simulate(games: number, makePlan: Strategy): { survived: number; endings: Record<Ending, number> } {
  const endings: Record<Ending, number> = {
    full_recovery: 0,
    managed_sacrifice: 0,
    self_governance: 0,
    collapse: 0,
  }
  for (let g = 0; g < games; g++) {
    let s = createInitialState(1000 + g)
    let rng: RngState = { seed: 9000 + g, counter: 0 }
    let guard = 0
    while (s.phase === 'planning' && guard++ < 45) {
      const { plan, rng: next } = makePlan(s, rng)
      rng = next
      s = step(s, { type: 'commitDay', plan }).state
      assertInvariants(s)
    }
    expect(s.phase).toBe('ended')
    expect(s.ending).toBeDefined()
    if (s.ending) endings[s.ending] += 1
  }
  return { survived: games - endings.collapse, endings }
}

const skilledPlan: Strategy = (s, rng) => ({ plan: autoAssign(s), rng })

describe('simulation', () => {
  it('無作為プレイで不変条件が保たれ、必ず終了する', () => {
    const GAMES = 40
    const { survived, endings } = simulate(GAMES, randomPlan)
    console.log(
      `[sim:random] ${GAMES} games / survived ${survived} (${Math.round((survived / GAMES) * 100)}%)`,
      endings,
    )
  })

  it('おまかせ配置（熟練）で不変条件が保たれ、必ず終了する', () => {
    const GAMES = 60
    const { survived, endings } = simulate(GAMES, skilledPlan)
    console.log(
      `[sim:skilled] ${GAMES} games / survived ${survived} (${Math.round((survived / GAMES) * 100)}%)`,
      endings,
    )
  })
})
