import { UNIQUE_UNITS, cloneUnit } from '../../game/data/units'
import { createInitialState } from '../../game/state'
import type { Effect, GameState } from '../../game/types'
import type { Beat } from '../playback/beats'
import type { PlanState } from '../plan'
import type { FacilityId } from '../town/layout'

export const PRESENTATION_FIXTURE_NAMES = [
  'planning',
  'unit-focus',
  'facility-focus',
  'flow',
  'event',
  'choice',
  'arrival',
  'ending',
  'title',
  'menu',
] as const

export type PresentationFixtureName = (typeof PRESENTATION_FIXTURE_NAMES)[number]

export interface PresentationFixture {
  name: PresentationFixtureName
  state: GameState
  baseState?: GameState
  beat?: Beat
  selectedUnitId?: string
  selectedFacility?: FacilityId
  plan?: PlanState
  scene: 'title' | 'play'
  menuOpen?: boolean
}

const SEED = 190010

function effect(source: string, target: Effect['target'], delta: number, reason: string): Effect {
  return { day: 8, source, target, delta, reason }
}

function planningState(): GameState {
  const state = createInitialState(SEED)
  return {
    ...state,
    day: 8,
    resources: { food: 68, power: 54, medical: 61, morale: 72 },
    budget: 48,
    stockpile: 37,
    modifiers: [
      {
        id: 'cold_snap',
        daysLeft: 2,
        startDay: 7,
        effects: [{ target: 'decay:power', op: 'mult', value: 1.3 }],
      },
    ],
  }
}

export function buildPresentationFixture(name: PresentationFixtureName): PresentationFixture {
  const state = planningState()
  const firstUnitId = state.units[0]?.id
  if (!firstUnitId) throw new Error('Presentation fixture requires an initial unit')

  if (name === 'title') return { name, state, scene: 'title' }
  if (name === 'menu') return { name, state, scene: 'play', menuOpen: true }
  if (name === 'unit-focus') {
    return {
      name,
      state,
      scene: 'play',
      selectedUnitId: firstUnitId,
      plan: { placements: { restore_road: [firstUnitId] }, ration: false, procure: false },
    }
  }
  if (name === 'facility-focus') {
    return {
      name,
      state,
      scene: 'play',
      selectedFacility: 'road',
      plan: { placements: { restore_road: [firstUnitId] }, ration: false, procure: false },
    }
  }
  if (name === 'flow') {
    const effects = [
      effect('task:repair_power', 'power', 14, '技術班が仮設発電機を修復した'),
      effect('task:repair_power', 'budget', -5, '修復資材を購入した'),
    ]
    return {
      name,
      state,
      baseState: state,
      beat: { kind: 'flow', source: 'task:repair_power', actorIds: [firstUnitId], effects },
      scene: 'play',
    }
  }
  if (name === 'event') {
    const effects = [
      effect('event:generator_failure', 'power', -32, '発電機が故障し、電力が大きく落ちた'),
    ]
    return {
      name,
      state,
      baseState: state,
      beat: { kind: 'event', id: 'generator_failure', effects },
      scene: 'play',
    }
  }
  if (name === 'choice') {
    return {
      name,
      state: {
        ...state,
        phase: 'choice',
        pendingChoice: {
          eventId: 'trade_offer',
          optionIds: ['buy_food', 'buy_medical', 'sell_stockpile', 'buy_stockpile', 'decline'],
        },
      },
      scene: 'play',
    }
  }
  if (name === 'arrival') {
    const arrival = cloneUnit(UNIQUE_UNITS[0]!)
    const effects = [
      {
        ...effect('event:arrival', `unit:${arrival.id}`, 0, `${arrival.name}が町に辿り着いた`),
        unitChanges: [{ kind: 'sync' as const, unit: arrival }],
      },
      effect('event:arrival', 'morale', 2, '新たな仲間に希望が湧いた'),
    ]
    return {
      name,
      state: { ...state, units: [...state.units, arrival] },
      baseState: state,
      beat: { kind: 'arrival', unitId: arrival.id, effects },
      scene: 'play',
    }
  }
  if (name === 'ending') {
    return {
      name,
      state: {
        ...state,
        day: 31,
        phase: 'ended',
        ending: 'full_recovery',
        flags: { ...state.flags, cooperation: 8, refugeesAccepted: 3 },
      },
      scene: 'play',
    }
  }
  return { name, state, scene: 'play' }
}
