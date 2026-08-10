import { BALANCE } from '../../game/data/balance'
import { UNIQUE_UNITS, cloneUnit } from '../../game/data/units'
import { createInitialState } from '../../game/state'
import type { Effect, GameState } from '../../game/types'
import type { Beat, PlaybackContext } from '../playback/beats'
import type { PlanState } from '../plan'
import type { PlanningIntent } from '../planning/placement'

export const PRESENTATION_FIXTURE_NAMES = [
  'planning',
  'planning-assigned',
  'unit-focus',
  'character-inspector',
  'facility-focus',
  'minor-result',
  'normal-result',
  'major-result',
  'act-stalemate',
  'act-final',
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
  playbackContext?: PlaybackContext
  planningIntent?: PlanningIntent
  plan?: PlanState
  scene: 'title' | 'play'
  menuOpen?: boolean
  inspectedUnitId?: string
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

function actFixture(name: 'act-stalemate' | 'act-final'): PresentationFixture {
  const stalemate = name === 'act-stalemate'
  const id = stalemate ? 'act_stalemate' : 'act_final'
  const day = stalemate ? BALANCE.acts.stalemate.start : BALANCE.acts.final.start
  const state = { ...planningState(), day }
  const effects: Effect[] = [
    {
      day: day - 1,
      source: id,
      target: 'flag:act',
      delta: 0,
      reason: stalemate ? '膠着期へ移行した' : '正念場へ移行した',
    },
  ]
  return {
    name,
    state,
    baseState: state,
    beat: { kind: 'milestone', id, effects },
    scene: 'play',
  }
}

export function buildPresentationFixture(name: PresentationFixtureName): PresentationFixture {
  const state = planningState()
  const firstUnitId = state.units[0]?.id
  if (!firstUnitId) throw new Error('Presentation fixture requires an initial unit')

  if (name === 'title') return { name, state, scene: 'title' }
  if (name === 'menu') return { name, state, scene: 'play', menuOpen: true }
  if (name === 'act-stalemate' || name === 'act-final') return actFixture(name)
  if (name === 'planning-assigned') {
    const assigned = state.units.slice(0, 4).map((unit) => unit.id)
    if (assigned.length !== 4) {
      throw new Error('Assigned planning fixture requires four initial units')
    }
    return {
      name,
      state,
      scene: 'play',
      plan: {
        placements: {
          repair_power: [assigned[0]!],
          restore_road: [assigned[1]!],
          reinforce_medical: [assigned[2]!],
          soup_kitchen: [assigned[3]!],
        },
        ration: false,
        procure: false,
      },
    }
  }
  if (name === 'unit-focus' || name === 'character-inspector') {
    return {
      name,
      state,
      scene: 'play',
      planningIntent: { kind: 'place-unit', unitId: firstUnitId },
      plan: { placements: { restore_road: [firstUnitId] }, ration: false, procure: false },
      inspectedUnitId: name === 'character-inspector' ? firstUnitId : undefined,
    }
  }
  if (name === 'facility-focus') {
    return {
      name,
      state,
      scene: 'play',
      planningIntent: { kind: 'inspect-facility', facilityId: 'road' },
      plan: { placements: { restore_road: [firstUnitId] }, ration: false, procure: false },
    }
  }
  if (name === 'minor-result') {
    const effects = [effect('settlement', 'food', -8, '人々が食料を消費した')]
    return {
      name,
      state,
      baseState: state,
      beat: { kind: 'flow', source: 'settlement', actorIds: [], effects },
      scene: 'play',
    }
  }
  if (name === 'normal-result' || name === 'major-result') {
    const delta = name === 'major-result' ? 30 : 14
    const effects = [
      effect('task:repair_power', 'power', delta, '技術班が仮設発電機を修復した'),
      effect('task:repair_power', 'budget', -5, '修復資材を購入した'),
    ]
    return {
      name,
      state,
      baseState: state,
      beat: { kind: 'flow', source: 'task:repair_power', actorIds: [firstUnitId], effects },
      playbackContext: { taskActors: { repair_power: [firstUnitId] } },
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

export function fixturePresentationMode(name: PresentationFixtureName): string {
  if (name === 'planning-assigned') return 'planning'
  if (name === 'character-inspector') return 'unit-focus'
  if (name === 'act-stalemate' || name === 'act-final') return 'milestone'
  if (name.endsWith('-result')) return 'flow'
  return name
}
