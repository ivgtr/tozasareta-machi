import { BALANCE } from '../../game/data/balance'
import type { Ending, GameState, Unit } from '../../game/types'
import { COLORS } from '../tokens'

interface EndingCopy {
  eyebrow: string
  title: string
  flavor: string
  accent: number
}

const ENDING_COPY: Record<Ending, EndingCopy> = {
  full_recovery: {
    eyebrow: 'FINAL REPORT / RESCUE COMPLETE',
    title: '完全復旧',
    flavor: '町は光を取り戻した。あなたの30日間は、奇跡として語り継がれるだろう。',
    accent: COLORS.green,
  },
  managed_sacrifice: {
    eyebrow: 'FINAL REPORT / TOWN SURVIVED',
    title: '管理された犠牲',
    flavor: '町は存続した。だが、その代償は決して小さくなかった。',
    accent: COLORS.amber,
  },
  self_governance: {
    eyebrow: 'FINAL REPORT / SELF GOVERNANCE',
    title: '住民自治',
    flavor: '復旧は遅れた。だが町は、何にも代えがたい結びつきを手に入れた。',
    accent: COLORS.cyan,
  },
  collapse: {
    eyebrow: 'FINAL REPORT / OPERATION FAILED',
    title: '崩壊',
    flavor: '町は静まり返った。あなたの30日間は、途中で途絶えた。',
    accent: COLORS.red,
  },
}

export interface EndingPresentationModel {
  ending: Ending
  eyebrow: string
  title: string
  flavor: string
  accent: number
  witness: Unit | null
  reachedDay: number
  resources: Array<{ label: string; value: number }>
  records: Array<{ label: string; value: number }>
}

export function deriveEndingPresentation(state: GameState): EndingPresentationModel | null {
  if (!state.ending) return null
  const copy = ENDING_COPY[state.ending]
  return {
    ending: state.ending,
    eyebrow: copy.eyebrow,
    title: copy.title,
    flavor: copy.flavor,
    accent: copy.accent,
    witness:
      state.units.find((unit) => unit.id === 'mayor') ??
      state.units.find((unit) => unit.unique) ??
      state.units[0] ??
      null,
    reachedDay: Math.max(1, Math.min(state.day - 1, BALANCE.days)),
    resources: [
      { label: '食料', value: Math.round(state.resources.food) },
      { label: '電力', value: Math.round(state.resources.power) },
      { label: '医療', value: Math.round(state.resources.medical) },
      { label: '士気', value: Math.round(state.resources.morale) },
    ],
    records: [
      { label: '稼働人員', value: state.units.length },
      { label: '犠牲者', value: state.flags.casualties },
      { label: '協力', value: state.flags.cooperation },
      { label: '受入', value: state.flags.refugeesAccepted },
      { label: '予算', value: state.budget },
      { label: '備蓄', value: state.stockpile },
    ],
  }
}
