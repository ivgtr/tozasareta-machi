import { BALANCE } from '../../game/data/balance'
import type { Ending, GameState, Unit } from '../../game/types'
import { COLORS } from '../tokens'

interface EndingCopy {
  eyebrow: string
  title: string
  accent: number
}

const ENDING_COPY: Record<Ending, EndingCopy> = {
  full_recovery: {
    eyebrow: 'FINAL REPORT / RESCUE COMPLETE',
    title: '完全復旧',
    accent: COLORS.green,
  },
  managed_sacrifice: {
    eyebrow: 'FINAL REPORT / TOWN SURVIVED',
    title: '管理された犠牲',
    accent: COLORS.amber,
  },
  self_governance: {
    eyebrow: 'FINAL REPORT / SELF GOVERNANCE',
    title: '住民自治',
    accent: COLORS.cyan,
  },
  collapse: {
    eyebrow: 'FINAL REPORT / OPERATION FAILED',
    title: '崩壊',
    accent: COLORS.red,
  },
}

export interface EndingNarrative {
  opening: string
  outcome: string
}

export interface EndingPresentationModel {
  ending: Ending
  eyebrow: string
  title: string
  accent: number
  narrative: EndingNarrative
  witness: Unit | null
  reachedDay: number
  resources: Array<{ label: string; value: number }>
  records: Array<{ label: string; value: number }>
}

export function deriveEndingNarrative(state: GameState): EndingNarrative | null {
  if (!state.ending) return null

  const { casualties, cooperation, refugeesAccepted } = state.flags
  const hasRefugees = refugeesAccepted > 0
  const highCooperation = cooperation >= BALANCE.ending.selfGovernanceCoop

  switch (state.ending) {
    case 'full_recovery': {
      const opening = '救援隊が山道を越えた朝、町にはまだ灯りが残っていた。'
      if (casualties === 0 && hasRefugees) {
        return {
          opening,
          outcome: '避難者を受け入れながら、誰一人欠けずに30日を越えた。',
        }
      }
      if (casualties > 0) {
        return {
          opening,
          outcome: '失った仲間の不在を抱えながら、それでも町の灯りを救援の日までつないだ。',
        }
      }
      if (highCooperation) {
        return {
          opening,
          outcome: '役割を引き受け合う動きが根づき、町は救援の日まで自力で機能し続けた。',
        }
      }
      return { opening, outcome: '誰一人欠けることなく、町は30日を越えた。' }
    }

    case 'managed_sacrifice': {
      const opening = '救援隊は、傷ついた町へたどり着いた。'
      if (casualties > 0) {
        return {
          opening,
          outcome: '町は残ったが、その姿を見ることができなかった者もいる。',
        }
      }
      if (hasRefugees) {
        return {
          opening,
          outcome: '新たに迎えた人々も含め、残った者たちは救援隊を迎えた。',
        }
      }
      if (
        state.resources.power < BALANCE.ending.fullRecovery.power ||
        state.resources.medical < BALANCE.ending.fullRecovery.medical
      ) {
        return {
          opening,
          outcome: '電力も医療も十分とは言えなかったが、町は救援の日まで持ちこたえた。',
        }
      }
      return { opening, outcome: '万全ではなかった。それでも、町は救援の日まで持ちこたえた。' }
    }

    case 'self_governance': {
      const opening = '復旧は遅れた。'
      if (hasRefugees) {
        return {
          opening,
          outcome: '避難者も輪に加わり、町は命令を待たず動ける共同体へ変わっていた。',
        }
      }
      if (casualties > 0) {
        return {
          opening,
          outcome: '失ったものを抱えながらも、残った人々は自分たちで町を動かし始めていた。',
        }
      }
      if (highCooperation) {
        return {
          opening,
          outcome: '30日の間に、町は命令を待たず動ける共同体へ変わっていた。',
        }
      }
      return { opening, outcome: '人々は救援を待つだけでなく、自分たちで町を動かし始めていた。' }
    }

    case 'collapse': {
      const opening = '救援を待つ時間は、最後まで残されなかった。'
      if (state.units.length === 0) {
        return {
          opening,
          outcome: '指揮所に応える者はもういなかった。町の30日間は、そこで途絶えた。',
        }
      }
      if (casualties > 0) {
        return {
          opening,
          outcome: '人を失うたびに町の力は細り、救援を迎える前に共同体は崩れた。',
        }
      }
      if (state.resources.morale <= BALANCE.ending.collapseMorale) {
        return {
          opening,
          outcome: '人々をつなぎ止める力が尽き、救援を迎える前に町は崩れた。',
        }
      }
      return { opening, outcome: '町を支える力は尽き、30日を迎える前に共同体は崩れた。' }
    }
  }
}

export function deriveEndingPresentation(state: GameState): EndingPresentationModel | null {
  if (!state.ending) return null
  const copy = ENDING_COPY[state.ending]
  const narrative = deriveEndingNarrative(state)
  if (!narrative) return null

  return {
    ending: state.ending,
    eyebrow: copy.eyebrow,
    title: copy.title,
    accent: copy.accent,
    narrative,
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
