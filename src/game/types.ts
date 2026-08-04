export type TaskId =
  'repair_power' | 'restore_road' | 'reinforce_medical' | 'soup_kitchen' | 'ration'

export type Aptitude = 'labor' | 'tech' | 'medical' | 'charm'

export type TraitId =
  'hard_worker' | 'leader' | 'sturdy' | 'popular' | 'frail' | 'troublemaker' | 'clumsy'

export type Condition = 'healthy' | 'injured'

export interface Unit {
  id: string
  name: string
  alias?: string
  unique?: boolean
  flavor?: string
  portrait: string
  apt: Record<Aptitude, number>
  traits: TraitId[]
  condition: Condition
  xp: number
  expedition?: number
}

export type EffectTarget =
  | 'food'
  | 'power'
  | 'medical'
  | 'morale'
  | 'budget'
  | 'stockpile'
  | `flag:${string}`
  | `unit:${string}`

export interface Effect {
  day: number
  source: string
  target: EffectTarget
  delta: number
  reason: string
}

export interface Resources {
  food: number
  power: number
  medical: number
  morale: number
}

export interface Flags {
  daysWithoutMedical: number
  daysFoodCut: number
  casualties: number
  refugeesAccepted: number
  cooperation: number
  fired: string[]
  joinedUniques: string[]
}

export interface RngState {
  seed: number
  counter: number
}

export type Phase = 'planning' | 'choice' | 'ended'

export type Ending = 'full_recovery' | 'managed_sacrifice' | 'self_governance' | 'collapse'

export interface PendingChoice {
  eventId: string
  optionIds: string[]
}

export interface ModifierEffect {
  target: string
  op: 'mult' | 'add' | 'set'
  value: number
}

export interface Modifier {
  id: string
  daysLeft: number
  startDay: number
  effects: ModifierEffect[]
}

export interface GameState {
  version: number
  day: number
  phase: Phase
  resources: Resources
  budget: number
  stockpile: number
  units: Unit[]
  flags: Flags
  rng: RngState
  report: Effect[]
  modifiers: Modifier[]
  ending?: Ending
  pendingEvents?: string[]
  pendingChoice?: PendingChoice
}

export interface Placement {
  task: TaskId
  unitIds: string[]
}

export interface DayPlan {
  placements: Placement[]
  ration: boolean
  procure: boolean
}

export type Action =
  { type: 'commitDay'; plan: DayPlan } | { type: 'resolveChoice'; optionId: string }

export interface StepResult {
  state: GameState
  effects: Effect[]
}

export interface EvalContext {
  state: GameState
  flags: Flags
  day: number
}

export interface ChoiceOption {
  id: string
  label: string
  desc?: string
  when?: (ctx: EvalContext) => boolean
  apply?: (ctx: EvalContext) => Effect[]
  mutate?: (state: GameState) => { state: GameState; effects: Effect[] }
}

export interface EventDef {
  id: string
  name: string
  desc?: string
  kind?: 'auto' | 'choice'
  once?: boolean
  when: (ctx: EvalContext) => boolean
  weight: (ctx: EvalContext) => number
  apply?: (ctx: EvalContext) => Effect[]
  mutate?: (state: GameState) => { state: GameState; effects: Effect[] }
  choices?: ChoiceOption[]
  perUnit?: (unit: Unit, ctx: EvalContext) => ChoiceOption
}

export type NumericFlag =
  'daysWithoutMedical' | 'daysFoodCut' | 'casualties' | 'refugeesAccepted' | 'cooperation'
