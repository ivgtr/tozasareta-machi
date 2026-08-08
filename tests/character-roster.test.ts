import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { deriveCharacterRoster } from '../src/scene/character/roster'
import { emptyPlan } from '../src/scene/plan'

describe('deriveCharacterRoster', () => {
  it('配置後も全員を元の順序で維持し、状態を付与する', () => {
    const state = createInitialState(19)
    const [assigned, waiting, expedition] = state.units
    if (!assigned || !waiting || !expedition) throw new Error('initial roster requires three units')
    expedition.expedition = state.day + 2
    const plan = {
      ...emptyPlan(),
      placements: { repair_power: [assigned.id] },
    }

    const roster = deriveCharacterRoster(state, plan)

    expect(roster.map((entry) => entry.unit.id)).toEqual(state.units.map((unit) => unit.id))
    expect(roster.find((entry) => entry.unit.id === assigned.id)?.status).toEqual({
      kind: 'assigned',
      task: 'repair_power',
    })
    expect(roster.find((entry) => entry.unit.id === waiting.id)?.status).toEqual({
      kind: 'waiting',
    })
    expect(roster.find((entry) => entry.unit.id === expedition.id)?.status).toEqual({
      kind: 'expedition',
    })
  })
})
