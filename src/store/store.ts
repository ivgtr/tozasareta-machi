import { z } from 'zod'
import type { DayPlan, EffectTarget, GameState } from '../game/types'
import { createInitialState } from '../game/state'
import { step } from '../game/engine'
import { SAVE_VERSION } from '../game/data/balance'
import { RANDOM_PORTRAIT_IDS, selectRandomPortrait } from '../game/data/units'

export interface StoreState {
  state: GameState
  history: GameState[]
}

export type StoreAction =
  | { type: 'newGame'; seed: number }
  | { type: 'commitDay'; plan: DayPlan }
  | { type: 'resolveChoice'; optionId: string }
  | { type: 'undo' }

export const HISTORY_LIMIT = 30
const SAVE_KEY = 'tozasareta-machi:save'

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}

export function storeReducer(store: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'newGame':
      return { state: createInitialState(action.seed), history: [] }
    case 'commitDay': {
      const result = step(store.state, { type: 'commitDay', plan: action.plan })
      if (result.state === store.state) return store
      const history = [...store.history, store.state].slice(-HISTORY_LIMIT)
      return { state: result.state, history }
    }
    case 'resolveChoice': {
      const result = step(store.state, { type: 'resolveChoice', optionId: action.optionId })
      if (result.state === store.state) return store
      return { state: result.state, history: store.history }
    }
    case 'undo': {
      const last = store.history[store.history.length - 1]
      if (!last) return store
      return { state: last, history: store.history.slice(0, -1) }
    }
  }
}

const ResourcesSchema = z.object({
  food: z.number(),
  power: z.number(),
  medical: z.number(),
  morale: z.number(),
})

const AptSchema = z.object({
  labor: z.number(),
  tech: z.number(),
  medical: z.number(),
  charm: z.number(),
})

const TraitSchema = z.enum([
  'hard_worker',
  'leader',
  'sturdy',
  'popular',
  'frail',
  'troublemaker',
  'clumsy',
])

const UnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  alias: z.string().optional(),
  unique: z.boolean().optional(),
  flavor: z.string().optional(),
  portrait: z.string(),
  apt: AptSchema,
  traits: z.array(TraitSchema),
  condition: z.enum(['healthy', 'injured']),
  xp: z.number(),
  expedition: z.number().optional(),
})

const FlagsSchema = z.object({
  daysWithoutMedical: z.number(),
  daysFoodCut: z.number(),
  casualties: z.number(),
  refugeesAccepted: z.number(),
  cooperation: z.number(),
  fired: z.array(z.string()),
  joinedUniques: z.array(z.string()),
})

const RngSchema = z.object({ seed: z.number(), counter: z.number() })

const EffectTargetSchema = z.custom<EffectTarget>((v) => typeof v === 'string')

const EffectSchema = z.object({
  day: z.number(),
  source: z.string(),
  target: EffectTargetSchema,
  delta: z.number(),
  reason: z.string(),
})

const PendingChoiceSchema = z.object({
  eventId: z.string(),
  optionIds: z.array(z.string()),
})

const ModifierEffectSchema = z.object({
  target: z.string(),
  op: z.enum(['mult', 'add', 'set']),
  value: z.number(),
})

const ModifierSchema = z.object({
  id: z.string(),
  daysLeft: z.number(),
  startDay: z.number(),
  effects: z.array(ModifierEffectSchema),
})

const GameStateSchema = z.object({
  version: z.number(),
  day: z.number(),
  phase: z.enum(['planning', 'choice', 'ended']),
  resources: ResourcesSchema,
  budget: z.number(),
  stockpile: z.number(),
  units: z.array(UnitSchema),
  flags: FlagsSchema,
  rng: RngSchema,
  report: z.array(EffectSchema),
  modifiers: z.array(ModifierSchema),
  ending: z.enum(['full_recovery', 'managed_sacrifice', 'self_governance', 'collapse']).optional(),
  pendingEvents: z.array(z.string()).optional(),
  pendingChoice: PendingChoiceSchema.optional(),
})

const SaveDataSchema = z.object({
  version: z.number(),
  store: z.object({ state: GameStateSchema, history: z.array(GameStateSchema) }),
})

const migrations: Record<number, (raw: unknown) => unknown> = {}

const PORTRAIT_POOL = new Set<string>(RANDOM_PORTRAIT_IDS)

function normalizePortraits(store: StoreState): StoreState {
  const assigned = new Map<string, string>()

  const normalizeState = (state: GameState): GameState => {
    const used: string[] = []
    const units = state.units.map((unit) => {
      if (PORTRAIT_POOL.has(unit.portrait)) {
        used.push(unit.portrait)
        return unit
      }
      if (!unit.id.startsWith('recruit_')) return unit
      let portrait = assigned.get(unit.id)
      if (!portrait) {
        portrait = selectRandomPortrait(state.rng.seed, unit.id, used)
        assigned.set(unit.id, portrait)
      }
      used.push(portrait)
      return { ...unit, portrait }
    })
    return { ...state, units }
  }

  const history = store.history.map(normalizeState)
  return { state: normalizeState(store.state), history }
}

export function serializeStore(store: StoreState): string {
  const data: z.infer<typeof SaveDataSchema> = { version: SAVE_VERSION, store }
  return JSON.stringify(data)
}

export function parseStore(json: string): StoreState | null {
  try {
    let raw: unknown = JSON.parse(json)
    const version =
      typeof raw === 'object' && raw !== null && 'version' in raw
        ? (raw as { version: unknown }).version
        : undefined
    if (typeof version === 'number') {
      let cur = version
      while (cur < SAVE_VERSION) {
        const migrate = migrations[cur]
        if (!migrate) break
        raw = migrate(raw)
        cur += 1
      }
    }
    const parsed = SaveDataSchema.safeParse(raw)
    if (!parsed.success || parsed.data.version !== SAVE_VERSION) return null
    return normalizePortraits(parsed.data.store)
  } catch {
    return null
  }
}

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

export function saveStore(store: StoreState): void {
  if (!storageAvailable()) return
  try {
    localStorage.setItem(SAVE_KEY, serializeStore(store))
  } catch {
    /* 保存失敗は無視（プライベートモード等） */
  }
}

export function loadStore(): StoreState | null {
  if (!storageAvailable()) return null
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? parseStore(raw) : null
  } catch {
    return null
  }
}

export function clearSave(): void {
  if (!storageAvailable()) return
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* 無視 */
  }
}
