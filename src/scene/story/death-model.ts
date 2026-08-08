import type { DeathBeat } from '../playback/beats'

const DEATH_CAUSE_LABEL: Record<DeathBeat['cause'], string> = {
  starvation: '食料不足',
  expedition: '探索中の事故',
}

export interface DeathPresentationModel {
  unit: DeathBeat['unit']
  causeLabel: string
  reason: string
}

export function deriveDeathPresentation(beat: DeathBeat): DeathPresentationModel {
  const unitTarget = `unit:${beat.unit.id}`
  const reason =
    beat.effects.find((effect) => effect.target === unitTarget)?.reason ??
    beat.effects.find((effect) => effect.reason)?.reason ??
    `${beat.unit.name}が亡くなった`

  return {
    unit: beat.unit,
    causeLabel: DEATH_CAUSE_LABEL[beat.cause],
    reason,
  }
}
