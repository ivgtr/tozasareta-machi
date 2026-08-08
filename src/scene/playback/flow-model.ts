import { isTaskId } from '../../game/data/tasks'
import type { Effect, GameState, Unit } from '../../game/types'
import { TARGET_LABEL } from '../labels'
import { TASK_PRESENTATION } from '../task-presentation'
import { resolveFx, type FxEntry } from '../town/fx-map'
import type { FacilityId } from '../town/layout'
import type { FlowBeat } from './beats'

export type FlowTone = 'positive' | 'negative' | 'neutral'

export interface FlowDelta {
  target: string
  label: string
  delta: number
  tone: FlowTone
}

export interface FlowPresentationModel {
  title: string
  kicker: string
  summary: string
  actors: Unit[]
  primaryActor: Unit | null
  facility: FacilityId | null
  fx: FxEntry
  tone: FlowTone
  deltas: FlowDelta[]
}

function toneOf(delta: number): FlowTone {
  if (delta > 0) return 'positive'
  if (delta < 0) return 'negative'
  return 'neutral'
}

function titleOf(beat: FlowBeat): string {
  if (beat.source.startsWith('task:')) {
    const task = beat.source.slice('task:'.length)
    if (isTaskId(task)) return TASK_PRESENTATION[task].label
    if (task === 'procure') return '備蓄を調達'
  }
  if (beat.source === 'settlement') return '一日の清算'
  if (beat.source === 'act_stalemate') return '膠着局面へ'
  if (beat.source === 'act_final') return '最終局面へ'
  return beat.effects.find((effect) => effect.reason)?.reason ?? '町の変化'
}

function aggregateDeltas(effects: readonly Effect[]): FlowDelta[] {
  const totals = new Map<string, number>()
  for (const effect of effects) {
    if (!(effect.target in TARGET_LABEL) || effect.delta === 0) continue
    totals.set(effect.target, (totals.get(effect.target) ?? 0) + effect.delta)
  }
  return [...totals.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([target, delta]) => ({
      target,
      label: TARGET_LABEL[target] ?? target,
      delta,
      tone: toneOf(delta),
    }))
}

function isPrimaryResult(effect: Effect): boolean {
  return effect.delta !== 0 && effect.target !== 'budget' && effect.target !== 'stockpile'
}

function resultEffect(beat: FlowBeat): Effect | undefined {
  const nonCost = [...beat.effects].reverse().find(isPrimaryResult)
  return nonCost ?? [...beat.effects].reverse().find((effect) => effect.delta !== 0)
}

function flowTone(beat: FlowBeat, deltas: readonly FlowDelta[]): FlowTone {
  if (beat.source.startsWith('task:')) return toneOf(resultEffect(beat)?.delta ?? 0)
  const hasPositive = deltas.some((delta) => delta.delta > 0)
  const hasNegative = deltas.some((delta) => delta.delta < 0)
  if (hasPositive && !hasNegative) return 'positive'
  if (hasNegative && !hasPositive) return 'negative'
  return 'neutral'
}

function kickerOf(beat: FlowBeat, actors: readonly Unit[]): string {
  if (actors.length > 0) {
    const first = actors[0]
    if (!first) return '担当者'
    return actors.length === 1 ? first.name : `${first.name} ほか${actors.length - 1}名`
  }
  if (beat.source.startsWith('task:')) return '対策本部の指示'
  if (beat.source === 'settlement') return '日次報告'
  if (beat.source.startsWith('act_')) return '局面転換'
  return '状況変化'
}

function isMeaningfulSummary(effect: Effect): boolean {
  return (
    effect.reason !== '' && effect.reason !== '予算を使った' && effect.reason !== '備蓄を使った'
  )
}

function summaryOf(beat: FlowBeat): string {
  if (beat.source === 'settlement') return '一日の消費と維持結果を反映した'
  const meaningful = [...beat.effects].reverse().find(isMeaningfulSummary)
  return meaningful?.reason ?? beat.effects[beat.effects.length - 1]?.reason ?? ''
}

export function deriveFlowPresentation(
  beat: FlowBeat,
  state: Pick<GameState, 'units'>,
): FlowPresentationModel {
  const actorSet = new Set(beat.actorIds)
  const actors = state.units.filter((unit) => actorSet.has(unit.id))
  const deltas = aggregateDeltas(beat.effects)
  const result = resultEffect(beat)
  const fx = resolveFx(beat.source, result?.target ?? beat.effects[0]?.target ?? '')
  const tone = flowTone(beat, deltas)
  return {
    title: titleOf(beat),
    kicker: kickerOf(beat, actors),
    summary: summaryOf(beat),
    actors,
    primaryActor: actors[0] ?? null,
    facility: fx.facility,
    fx,
    tone,
    deltas,
  }
}
