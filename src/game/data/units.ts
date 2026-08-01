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

const NAME_POOL = [
  '源吉',
  '美代',
  '宗助',
  'ハル',
  '清',
  'トミ',
  '伊助',
  'きく',
  '留吉',
  'さわ',
  '勘太',
  'まつ',
  '新助',
  'よね',
  '作蔵',
  'ちよ',
]

export const INITIAL_UNITS: Unit[] = [
  {
    id: 'mayor',
    name: '嘉悦',
    portrait: 'mayor',
    apt: { labor: 4, tech: 4, medical: 4, charm: 8 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'medic',
    name: '医師',
    portrait: 'medic',
    apt: { labor: 3, tech: 5, medical: 9, charm: 5 },
    traits: [],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'engineer',
    name: '技術者',
    portrait: 'engineer',
    apt: { labor: 5, tech: 9, medical: 3, charm: 3 },
    traits: [],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'farmer',
    name: '農夫',
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
    name: '取り残された技術者',
    portrait: 'stranded_engineer',
    apt: { labor: 5, tech: 9, medical: 3, charm: 4 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'retired_medic',
    name: '隠居した医師',
    portrait: 'retired_medic',
    apt: { labor: 3, tech: 4, medical: 9, charm: 6 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'young_volunteer',
    name: '若いボランティア',
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

export function makeRandomUnit(rng: RngState): { unit: Unit; rng: RngState } {
  let r = rng
  const [nv, r0] = nextRandom(r)
  r = r0
  const name = NAME_POOL[Math.floor(nv * NAME_POOL.length)] ?? '名無し'

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
