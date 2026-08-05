import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { step } from '../src/game/engine'
import { isOnExpedition } from '../src/game/actions'
import { BALANCE } from '../src/game/data/balance'
import type { Aptitude, DayPlan, Ending, GameState, Placement } from '../src/game/types'

function fullRecoveryPlan(s: GameState): DayPlan {
  const B = BALANCE
  const avail = s.units.filter((u) => !isOnExpedition(u))
  const present = avail.length
  const used = new Set<string>()
  const placements: Placement[] = []

  const pickBest = (apt: Aptitude, n: number): string[] => {
    const ids: string[] = []
    const sorted = avail.filter((u) => !used.has(u.id)).sort((a, b) => b.apt[apt] - a.apt[apt])
    for (const u of sorted.slice(0, n)) {
      used.add(u.id)
      ids.push(u.id)
    }
    return ids
  }

  let budget = s.budget
  const addTask = (task: Placement['task'], unitIds: string[], cost: number): boolean => {
    if (unitIds.length === 0) return false
    if (budget < cost) {
      for (const id of unitIds) used.delete(id)
      return false
    }
    budget -= cost
    placements.push({ task, unitIds })
    return true
  }

  const late = s.day >= 25
  const repairN = late
    ? s.resources.power < 90
      ? 2
      : 0
    : s.resources.power < 50
      ? 2
      : s.resources.power < 70
        ? 1
        : 0
  const medN = late
    ? s.resources.medical < 90
      ? 2
      : 0
    : s.resources.medical < 45
      ? 2
      : s.resources.medical < 70
        ? 1
        : 0
  const soupN = s.resources.morale < 40 ? 2 : s.resources.morale < 62 ? 1 : 0

  const foodEmergency =
    s.day < 26 && s.resources.food + s.stockpile < present * B.unit.foodPerUnit * 2
  const rN = foodEmergency ? Math.min(repairN, 1) : repairN
  const mN = foodEmergency ? Math.min(medN, 1) : medN
  const sN = foodEmergency ? Math.min(soupN, 1) : soupN

  const doRepair = () => addTask('repair_power', pickBest('tech', rN), B.tasks.repair_power.budget)
  const doMedical = () =>
    addTask('reinforce_medical', pickBest('medical', mN), B.tasks.reinforce_medical.budget)
  const doSoup = () => addTask('soup_kitchen', pickBest('charm', sN), B.tasks.soup_kitchen.budget)

  doRepair()
  if (foodEmergency && s.resources.morale >= 15) {
    doMedical()
    doSoup()
  } else if (foodEmergency || s.resources.morale < 25) {
    doSoup()
    doMedical()
  } else {
    doMedical()
    doSoup()
  }

  const rest = avail.filter((u) => !used.has(u.id)).sort((a, b) => b.apt.labor - a.apt.labor)
  if (rest.length > 0) placements.push({ task: 'restore_road', unitIds: rest.map((u) => u.id) })

  const need = present * B.unit.foodPerUnit + B.food.decay
  const ration = s.resources.food + s.stockpile < need * 2
  const procure =
    budget >= B.procure.budget &&
    ((budget > 50 && s.stockpile < 55) || (budget > 30 && s.stockpile < 20))

  return { placements, ration, procure }
}

function fullRecoveryChoice(s: GameState): string {
  const ids = s.pendingChoice?.optionIds ?? []
  if (ids.length === 0) return ''
  const has = (id: string) => ids.includes(id)
  if (ids.some((id) => id.startsWith('send_'))) {
    if (s.stockpile < BALANCE.expedition.cost + 5) return 'skip'
    const tight = s.resources.food + s.stockpile < s.units.length * BALANCE.unit.foodPerUnit * 3
    const aptCap = tight ? 6 : 5
    let worst = ''
    let worstApt = aptCap + 1
    for (const id of ids) {
      if (!id.startsWith('send_')) continue
      const u = s.units.find((x) => x.id === id.slice('send_'.length))
      if (!u) continue
      const apt = Math.max(u.apt.labor, u.apt.tech, u.apt.medical, u.apt.charm)
      if (apt < worstApt) {
        worstApt = apt
        worst = id
      }
    }
    return worst || 'skip'
  }
  if (has('buy_food')) {
    if (s.resources.food < 30 && s.budget >= 15) return 'buy_food'
    if (s.resources.food < 70 && s.budget >= 30) return 'buy_food'
    if (s.resources.medical < 40 && s.budget >= 40) return 'buy_medical'
    if (s.stockpile >= 30) return 'sell_stockpile'
    return 'decline'
  }
  if (has('divert_medical')) return s.resources.medical > 70 ? 'divert_medical' : 'endure_dark'
  if (has('distribute')) return s.resources.morale < 55 ? 'distribute' : 'reserve'
  return ids[0] ?? ''
}

describe('full_recovery 到達性', () => {
  it('full_recovery を狙うプレイで到達できる（autoAssign は狙わない）', () => {
    const GAMES = 60
    const endings: Record<Ending, number> = {
      full_recovery: 0,
      managed_sacrifice: 0,
      self_governance: 0,
      collapse: 0,
    }
    for (let g = 0; g < GAMES; g++) {
      let s = createInitialState(1000 + g)
      let guard = 0
      while (s.phase !== 'ended' && guard++ < 100) {
        if (s.phase === 'planning') {
          s = step(s, { type: 'commitDay', plan: fullRecoveryPlan(s) }).state
        } else if (s.phase === 'choice') {
          s = step(s, { type: 'resolveChoice', optionId: fullRecoveryChoice(s) }).state
        } else {
          break
        }
      }
      expect(s.phase).toBe('ended')
      expect(s.ending).toBeDefined()
      if (s.ending) endings[s.ending] += 1
    }
    console.log(`[sim:full_recovery狙い] ${GAMES} games /`, endings)
    expect(endings.full_recovery).toBeGreaterThanOrEqual(10)
  })
})
