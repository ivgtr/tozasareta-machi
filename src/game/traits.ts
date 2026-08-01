import type { TraitId } from './types'

export const TRAIT_IDS: TraitId[] = [
  'hard_worker',
  'leader',
  'sturdy',
  'popular',
  'frail',
  'troublemaker',
  'clumsy',
]

export interface TraitInfo {
  id: TraitId
  name: string
  desc: string
  positive: boolean
}

export const TRAITS: Record<TraitId, TraitInfo> = {
  hard_worker: {
    id: 'hard_worker',
    name: '働き者',
    desc: '任務の効果が1.3倍になる',
    positive: true,
  },
  leader: { id: 'leader', name: '指導者', desc: '同じ任務の他ユニットの適性+2', positive: true },
  sturdy: { id: 'sturdy', name: '頑丈', desc: '負傷しない', positive: true },
  popular: { id: 'popular', name: '人気者', desc: '毎日、士気+1', positive: true },
  frail: { id: 'frail', name: '虚弱', desc: '任務の効果が0.7倍になる', positive: false },
  troublemaker: { id: 'troublemaker', name: '問題児', desc: '毎日、士気-1', positive: false },
  clumsy: { id: 'clumsy', name: '不器用', desc: '負傷する確率が2倍になる', positive: false },
}
