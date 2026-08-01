import type { Aptitude, RngState, TraitId, Unit } from '../types'
import { BALANCE } from './balance'
import { TRAIT_IDS } from '../traits'
import { nextRandom } from '../rng'

export const APTITUDE_LABEL: Record<Aptitude, string> = {
  labor: '労力',
  tech: '技術',
  medical: '医療',
  charm: '人望',
}

const NAME_UPPER = [
  'お',
  '弥',
  '権',
  '徳',
  '吉',
  '七',
  '彦',
  '為',
  '勝',
  '鶴',
  '松',
  '岩',
  '千',
  '半',
  'や',
]
const NAME_LOWER = [
  '吉',
  '太郎',
  '次郎',
  '三郎',
  '五郎',
  '八',
  '江',
  '花',
  '作',
  '兵衛',
  '助',
  '蔵',
  '乃',
  '衛門',
  '一',
]
const SURNAME = [
  '山田',
  '小林',
  '斎藤',
  '鈴木',
  '高橋',
  '田中',
  '中村',
  '森',
  '林',
  '石川',
  '前田',
  '松本',
  '清水',
  '木村',
  '原',
]
const GIVEN = [
  '太郎',
  '次郎',
  '花子',
  '幸',
  '実',
  '誠',
  '恵',
  '明',
  '勇',
  '和子',
  '健',
  '正',
  '清',
  '豊',
  '久',
]
const WESTERN = [
  'ハンス',
  'フランツ',
  'ヨハン',
  'マリア',
  'アンナ',
  'ヨーゼフ',
  'クララ',
  'ハインリヒ',
  'ルーカス',
  'エリーゼ',
  'ヴィルヘルム',
  'ゲルダ',
  'オットー',
  'ロザリー',
  'マテオ',
]

function pick(rng: RngState, arr: string[]): [string, RngState] {
  const [v, r] = nextRandom(rng)
  return [arr[Math.floor(v * arr.length)] ?? '', r]
}

export function makeRandomName(rng: RngState, taken: string[]): { name: string; rng: RngState } {
  let r = rng
  let name = ''
  for (let attempt = 0; attempt < 8; attempt++) {
    const [pv, r1] = nextRandom(r)
    r = r1
    if (pv < 0.5) {
      const [u, r2] = pick(r, NAME_UPPER)
      const [l, r3] = pick(r2, NAME_LOWER)
      r = r3
      name = u + l
    } else if (pv < 0.8) {
      const [s, r2] = pick(r, SURNAME)
      const [g, r3] = pick(r2, GIVEN)
      r = r3
      name = s + g
    } else {
      const [w, r2] = pick(r, WESTERN)
      r = r2
      name = w
    }
    if (!taken.includes(name)) break
  }
  return { name: name || '旅人', rng: r }
}

export const INITIAL_UNITS: Unit[] = [
  {
    id: 'mayor',
    name: '嘉悦',
    alias: '町長',
    portrait: 'mayor',
    apt: { labor: 4, tech: 4, medical: 4, charm: 8 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'medic',
    name: '俊庵',
    alias: '医師',
    portrait: 'medic',
    apt: { labor: 3, tech: 5, medical: 9, charm: 5 },
    traits: [],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'engineer',
    name: 'ハインリヒ',
    alias: '技術者',
    portrait: 'engineer',
    apt: { labor: 5, tech: 9, medical: 3, charm: 3 },
    traits: [],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'farmer',
    name: '山田五郎',
    alias: '農夫',
    portrait: 'farmer',
    apt: { labor: 8, tech: 3, medical: 4, charm: 4 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
]

export const UNIQUE_UNITS: Unit[] = [
  {
    id: 'stranded_engineer',
    name: 'フランツ',
    alias: '取り残された技術者',
    portrait: 'stranded_engineer',
    apt: { labor: 5, tech: 9, medical: 3, charm: 4 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'retired_medic',
    name: '春仙',
    alias: '隠居した医師',
    portrait: 'retired_medic',
    apt: { labor: 3, tech: 4, medical: 9, charm: 6 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'young_volunteer',
    name: '鈴木新太郎',
    alias: '若いボランティア',
    portrait: 'young_volunteer',
    apt: { labor: 8, tech: 4, medical: 4, charm: 5 },
    traits: ['hard_worker'],
    condition: 'healthy',
    xp: 0,
  },
]

export function cloneUnit(unit: Unit, id = unit.id): Unit {
  return { ...unit, id, apt: { ...unit.apt }, traits: [...unit.traits] }
}

export function makeRandomUnit(rng: RngState, taken: string[]): { unit: Unit; rng: RngState } {
  const { name, rng: r0 } = makeRandomName(rng, taken)
  let r = r0

  const apts: Aptitude[] = ['labor', 'tech', 'medical', 'charm']
  const apt = {} as Record<Aptitude, number>
  for (const a of apts) {
    const [v, rr] = nextRandom(r)
    r = rr
    apt[a] = BALANCE.unit.aptMin + Math.floor(v * (BALANCE.unit.aptMax - BALANCE.unit.aptMin + 1))
  }
  const [pv, r1] = nextRandom(r)
  r = r1
  const peak = apts[Math.floor(pv * apts.length)] ?? 'labor'
  const [peakv, r2] = nextRandom(r)
  r = r2
  apt[peak] =
    BALANCE.unit.aptPeakMin +
    Math.floor(peakv * (BALANCE.unit.aptPeakMax - BALANCE.unit.aptPeakMin + 1))

  const traits: TraitId[] = []
  const [tv, r3] = nextRandom(r)
  r = r3
  if (tv < BALANCE.unit.traitChance) {
    const [ti, r4] = nextRandom(r)
    r = r4
    traits.push(TRAIT_IDS[Math.floor(ti * TRAIT_IDS.length)] ?? 'hard_worker')
  }

  const id = `recruit_${rng.counter}`
  const unit: Unit = { id, name, portrait: id, apt, traits, condition: 'healthy', xp: 0 }
  return { unit, rng: r }
}
