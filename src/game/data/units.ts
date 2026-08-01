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

const UNIQUE_UNIT_DEFS: Unit[] = [
  {
    id: 'stranded_engineer',
    name: 'フランツ',
    alias: '取り残された技術者',
    flavor: '発電所の視察に来た異国の技術者。道が断たれ、帰る術を失った。',
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
    flavor: 'かつて神の手と呼ばれた老医師。老いた身にも、人を救う術が染みついている。',
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
    flavor: 'じっとしていられない若者。誰かの役に立ちたくて、うずうずしている。',
    portrait: 'young_volunteer',
    apt: { labor: 8, tech: 4, medical: 4, charm: 5 },
    traits: ['hard_worker'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'eatery_widow',
    name: 'お富',
    alias: '食堂の未亡人',
    flavor: '夫を亡くした飯屋のおかみ。その手料理は、人々の心をあたためる。',
    portrait: 'eatery_widow',
    apt: { labor: 5, tech: 3, medical: 4, charm: 9 },
    traits: ['popular'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'blacksmith',
    name: '源蔵',
    alias: '鍛冶屋',
    flavor: '鉄と火を扱う職人。老いてもその腕は衰えを知らない。',
    portrait: 'blacksmith',
    apt: { labor: 9, tech: 7, medical: 2, charm: 2 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'nun',
    name: 'マルガレータ',
    alias: '修道女',
    flavor: '異国から来た修道女。祈りと看護で、人々の心を癒やす。',
    portrait: 'nun',
    apt: { labor: 3, tech: 3, medical: 8, charm: 8 },
    traits: ['popular'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'veteran',
    name: '鉄三',
    alias: '元兵士',
    flavor: 'いくつもの戦場をくぐり抜けた古強者。頼もしいが、手つきは荒い。',
    portrait: 'veteran',
    apt: { labor: 9, tech: 4, medical: 3, charm: 3 },
    traits: ['clumsy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'midwife',
    name: 'おかつ',
    alias: '産婆',
    flavor: '町で数えきれない子を取り上げてきた産婆。町の家族に明るい。',
    portrait: 'midwife',
    apt: { labor: 4, tech: 3, medical: 9, charm: 6 },
    traits: [],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'clerk',
    name: '渡辺菊',
    alias: '町長の補佐',
    flavor: 'かつて役場に勤めていた。細やかな采配で、後方を支える。',
    portrait: 'clerk',
    apt: { labor: 4, tech: 6, medical: 4, charm: 7 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'carpenter',
    name: 'ハンス',
    alias: '大工',
    flavor: '異国から来た大工。斧一つで、どんな建物も繕ってみせる。',
    portrait: 'carpenter',
    apt: { labor: 8, tech: 8, medical: 2, charm: 3 },
    traits: ['hard_worker'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'herbwoman',
    name: '八重',
    alias: '薬草の物知り',
    flavor: '山の薬草に詳しい女。その煎じ薬は、静かに人を救う。',
    portrait: 'herbwoman',
    apt: { labor: 3, tech: 5, medical: 8, charm: 4 },
    traits: [],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'hunter',
    name: '六蔵',
    alias: '狩人',
    flavor: '山を知り尽くした狩人。食料までもたらし、人を驚かせる。',
    portrait: 'hunter',
    apt: { labor: 9, tech: 5, medical: 3, charm: 2 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'teacher',
    name: '佐藤花子',
    alias: '寺子屋の師匠',
    flavor: '寺子屋で子を教えている。大人にも子にも慕われている。',
    portrait: 'teacher',
    apt: { labor: 3, tech: 6, medical: 5, charm: 7 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'youngmedic',
    name: 'クラウス',
    alias: '若い医師',
    flavor: '異国から来た若い医師。腕は確かだが、体が弱い。',
    portrait: 'youngmedic',
    apt: { labor: 4, tech: 7, medical: 8, charm: 3 },
    traits: ['frail'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'elderfarmer',
    name: '権兵衛',
    alias: '老農',
    flavor: '誰より土地を知る老農。その経験がよく物を言う。',
    portrait: 'elderfarmer',
    apt: { labor: 8, tech: 4, medical: 4, charm: 3 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'apprentice',
    name: '田中三郎',
    alias: '見習い',
    flavor: 'まだ修行中の若者。これからの成長に期待がかかる。',
    portrait: 'apprentice',
    apt: { labor: 6, tech: 7, medical: 3, charm: 4 },
    traits: ['hard_worker'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'weaver',
    name: 'おせい',
    alias: '織り子',
    flavor: '布を織る女。穏やかな人柄で、人を和ませる。',
    portrait: 'weaver',
    apt: { labor: 5, tech: 4, medical: 3, charm: 8 },
    traits: ['popular'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'boatman',
    name: '甚兵衛',
    alias: '船頭',
    flavor: '川を自在に操る船頭。輸送の命綱を握っている。',
    portrait: 'boatman',
    apt: { labor: 7, tech: 5, medical: 3, charm: 4 },
    traits: [],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'nurse',
    name: 'マリア',
    alias: '看護婦',
    flavor: '異国から来た看護婦。確かな手つきで医療を支える。',
    portrait: 'nurse',
    apt: { labor: 3, tech: 4, medical: 9, charm: 5 },
    traits: [],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'merchant',
    name: '吉兵衛',
    alias: '行商人',
    flavor: '抜け目のない商人。役に立つが、その金はきれいごとばかりではない。',
    portrait: 'merchant',
    apt: { labor: 4, tech: 7, medical: 3, charm: 8 },
    traits: ['troublemaker'],
    condition: 'healthy',
    xp: 0,
  },
]

export const UNIQUE_UNITS: Unit[] = UNIQUE_UNIT_DEFS.map((u) => ({ ...u, unique: true }))

const ALIAS_BY_APT: Record<Aptitude, string> = {
  labor: '力自慢',
  tech: '発明家',
  medical: '薬草通',
  charm: '人たらし',
}

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
  const unit: Unit = {
    id,
    name,
    alias: ALIAS_BY_APT[peak],
    portrait: id,
    apt,
    traits,
    condition: 'healthy',
    xp: 0,
  }
  return { unit, rng: r }
}
