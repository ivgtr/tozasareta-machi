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

type PlanStrategy = (state: GameState, rng: RngState) => { plan: DayPlan; rng: RngState }
type ChoiceStrategy = (state: GameState, rng: RngState) => { optionId: string; rng: RngState }

const randomChoice: ChoiceStrategy = (s, rng) => {
  const ids = s.pendingChoice?.optionIds ?? []
  if (ids.length === 0) return { optionId: '', rng }
  const [v, r1] = nextRandom(rng)
  return { optionId: ids[Math.floor(v * ids.length)] ?? '', rng: r1 }
}

const skilledChoice: ChoiceStrategy = (s, rng) => {
  const ids = s.pendingChoice?.optionIds ?? []
  if (ids.length === 0) return { optionId: '', rng }
  const sendOpts = ids.filter((id) => id.startsWith('send_'))
  if (sendOpts.length > 0) {
    let bestId = sendOpts[0] ?? ''
    let bestApt = -1
    for (const id of sendOpts) {
      const u = s.units.find((x) => x.id === id.slice('send_'.length))
      if (u) {
        const apt = Math.max(u.apt.labor, u.apt.tech, u.apt.medical, u.apt.charm)
        if (apt > bestApt) {
          bestApt = apt
          bestId = id
        }
      }
    }
    return { optionId: bestId, rng }
  }
  return { optionId: ids[0] ?? '', rng }
}

function simulate(
  games: number,
  makePlan: PlanStrategy,
  chooseOption: ChoiceStrategy,
): { survived: number; endings: Record<Ending, number> } {
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
    while (s.phase !== 'ended' && guard++ < 100) {
      if (s.phase === 'planning') {
        const { plan, rng: next } = makePlan(s, rng)
        rng = next
        s = step(s, { type: 'commitDay', plan }).state
      } else if (s.phase === 'choice') {
        const { optionId, rng: next } = chooseOption(s, rng)
        rng = next
        s = step(s, { type: 'resolveChoice', optionId }).state
      } else {
        break
      }
      assertInvariants(s)
    }
    expect(s.phase).toBe('ended')
    expect(s.ending).toBeDefined()
    if (s.ending) endings[s.ending] += 1
  }
  return { survived: games - endings.collapse, endings }
}

const skilledPlan: PlanStrategy = (s, rng) => ({ plan: autoAssign(s), rng })

describe('simulation', () => {
  it('無作為プレイで不変条件が保たれ、必ず終了する', () => {
    const GAMES = 40
    const { survived, endings } = simulate(GAMES, randomPlan, randomChoice)
    console.log(
      `[sim:random] ${GAMES} games / survived ${survived} (${Math.round((survived / GAMES) * 100)}%)`,
      endings,
    )
  })

  it('おまかせ配置（熟練）で不変条件が保たれ、必ず終了する', () => {
    const GAMES = 60
    const { survived, endings } = simulate(GAMES, skilledPlan, skilledChoice)
    console.log(
      `[sim:skilled] ${GAMES} games / survived ${survived} (${Math.round((survived / GAMES) * 100)}%)`,
      endings,
    )
  })
})
