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
    name: '真壁史子',
    alias: '二期目の町長',
    flavor:
      '町役場の福祉畑を歩み、住民の顔と暮らしを知る町長。診療所を守るため道路補強を先送りした判断を、胸の奥で悔いている。',
    portrait: 'mayor',
    apt: { labor: 4, tech: 4, medical: 4, charm: 8 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'medic',
    name: '榊直人',
    alias: '町の診療所医',
    flavor:
      '都市の病院から戻り、町で唯一の診療所を継いだ医師。限られた薬で救える命を選ばなければならない現実を、誰より理解している。',
    portrait: 'medic',
    apt: { labor: 3, tech: 5, medical: 9, charm: 5 },
    traits: [],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'engineer',
    name: '森レナ',
    alias: '発電所の保守技師',
    flavor:
      '町出身の母とドイツ人技師の父を持ち、この町で育った保守技師。交換部品が届く直前に道が断たれ、古い発電機を知る唯一の手となった。',
    portrait: 'engineer',
    apt: { labor: 5, tech: 9, medical: 3, charm: 3 },
    traits: [],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'farmer',
    name: '岩倉源造',
    alias: '山畑の農家',
    flavor:
      '段々畑を守ってきた農家で、元消防団長。林道も水路も古い貯蔵庫も身体で覚え、災害となれば誰より先に道具を持って現れる。',
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
    name: 'シド彦',
    alias: '取り残された技術者',
    flavor: '空飛ぶ船を造っていた異国の技師。壊れた機械を見ると放っておけない。',
    portrait: 'shidohiko',
    apt: { labor: 5, tech: 9, medical: 3, charm: 4 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'retired_medic',
    name: '野口栄世',
    alias: '隠世の医者',
    flavor: '海を渡って病を研究した医師。患者の前では寝食も借金も忘れる。',
    portrait: 'noguchieisei',
    apt: { labor: 3, tech: 5, medical: 9, charm: 5 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'young_volunteer',
    name: '緑谷出三',
    alias: '若いボランティア',
    flavor: '取り柄はなくとも、誰かが危ないと考えるより先に体が動く。',
    portrait: 'midoriyaizumi',
    apt: { labor: 6, tech: 4, medical: 4, charm: 7 },
    traits: ['hard_worker'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'eatery_widow',
    name: '惨事',
    alias: '食堂の未亡人',
    flavor: '海辺の食堂を継いだ未亡人。空腹の者には分け隔てなく料理を出す。',
    portrait: 'sanji',
    apt: { labor: 6, tech: 3, medical: 4, charm: 9 },
    traits: ['popular'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'blacksmith',
    name: '政宗',
    alias: '刀鍛冶',
    flavor: '名刀よりも、暮らしを支える鍬や斧を打つことを選んだ刀鍛冶。',
    portrait: 'masamune',
    apt: { labor: 9, tech: 7, medical: 2, charm: 2 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'nun',
    name: '結菜',
    alias: '修道女',
    flavor: '祈りと看護を学んだ巡礼者。死者を送り、生者の旅路を支える。',
    portrait: 'yuina',
    apt: { labor: 3, tech: 3, medical: 8, charm: 8 },
    traits: ['popular'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'veteran',
    name: '宮本武三',
    alias: '元兵士',
    flavor: '二本の得物を扱う歴戦の兵士。細かな作業では力加減を知らない。',
    portrait: 'miyamotomuzo',
    apt: { labor: 9, tech: 5, medical: 2, charm: 3 },
    traits: ['clumsy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'midwife',
    name: '南方仁三',
    alias: '町医者',
    flavor: 'まだ存在しない医術を語る町医者。目の前の命だけは見捨てない。',
    portrait: 'minakatajinzo',
    apt: { labor: 4, tech: 5, medical: 9, charm: 5 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'clerk',
    name: '石田三菊',
    alias: '町長の補佐',
    flavor: '三杯の菊茶と帳簿で人を量る、幾帳面すぎる町長補佐。',
    portrait: 'ishidasangiku',
    apt: { labor: 3, tech: 7, medical: 4, charm: 7 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'carpenter',
    name: '石神千久',
    alias: '大工',
    flavor: '石と木と廃材から道具を生み出す、計算好きの若い大工。',
    portrait: 'ishimichiku',
    apt: { labor: 7, tech: 8, medical: 2, charm: 4 },
    traits: ['hard_worker'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'herbwoman',
    name: '犬犬',
    alias: '薬草の物知り',
    flavor: '薬より毒に目を輝かせる薬草通。人間より薬瓶の扱いに慣れている。',
    portrait: 'inuinu',
    apt: { labor: 3, tech: 6, medical: 8, charm: 3 },
    traits: [],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'hunter',
    name: '松浦武四',
    alias: '狩人',
    flavor: '北の山野を歩き、その土地に残る古い道と名前を地図に記してきた。',
    portrait: 'matsuuraakeshi',
    apt: { labor: 8, tech: 6, medical: 3, charm: 2 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'teacher',
    name: '吉田松院',
    alias: '寺子屋の師匠',
    flavor: '粗末な小屋で若者を教える師匠。門が閉じれば壁を破れと説く。',
    portrait: 'yoshidashoin',
    apt: { labor: 3, tech: 6, medical: 4, charm: 8 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'youngmedic',
    name: '胡蝶ばれる',
    alias: '若い医師',
    flavor: '毒と針を操る小柄な医師。笑顔の裏の感情は隠しきれない。',
    portrait: 'kochobareru',
    apt: { labor: 3, tech: 7, medical: 9, charm: 4 },
    traits: ['frail'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'elderfarmer',
    name: '二宮尊三',
    alias: '老農',
    flavor: '薪を背負って学び、荒れた畑と傾いた家計を立て直してきた老農。',
    portrait: 'ninomiyasonzo',
    apt: { labor: 8, tech: 5, medical: 4, charm: 3 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'apprentice',
    name: 'エド丸',
    alias: '見習い',
    flavor: '義手を自作した錬金術見習い。背丈と材料費の話には少しうるさい。',
    portrait: 'edomaru',
    apt: { labor: 5, tech: 8, medical: 3, charm: 4 },
    traits: ['hard_worker'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'weaver',
    name: '星野うさぎ',
    alias: '織り子',
    flavor: '泣き虫で人懐こい織り子。暗い夜でも町に笑顔を取り戻す。',
    portrait: 'hoshinousagi',
    apt: { labor: 4, tech: 3, medical: 4, charm: 9 },
    traits: ['popular'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'boatman',
    name: '万三郎',
    alias: '船頭',
    flavor: '嵐で異国へ流され、航海術と言葉を持ち帰った流れ者の船頭。',
    portrait: 'manzaburo',
    apt: { labor: 7, tech: 5, medical: 3, charm: 4 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'nurse',
    name: '夜鳴ケイ',
    alias: '灯持ちの看護婦',
    flavor: '夜ごと灯を掲げ、衛生と数字で傷病者を守る看護婦。',
    portrait: 'nantei',
    apt: { labor: 3, tech: 5, medical: 9, charm: 6 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'merchant',
    name: '紀文左',
    alias: '行商人',
    flavor: 'みかん一船で財を築いた行商人。災害の中にも商機を見つける。',
    portrait: 'kibunza',
    apt: { labor: 4, tech: 7, medical: 3, charm: 8 },
    traits: ['troublemaker'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'small_detective',
    name: '江戸川困難',
    alias: '小さな探偵',
    flavor: '見た目は子供だが、物資が消えると大人顔負けの推理を始める。',
    portrait: 'edogawakonnan',
    apt: { labor: 2, tech: 8, medical: 4, charm: 7 },
    traits: ['troublemaker'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'reluctant_operator',
    name: '碇シン次',
    alias: '臨時重機乗り',
    flavor: '乗りたくないと言いながら、誰より正確に大型重機を動かす少年。',
    portrait: 'ikarishinji',
    apt: { labor: 4, tech: 9, medical: 3, charm: 3 },
    traits: ['frail'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'mountain_courier',
    name: '藤原宅海',
    alias: '峠の配達人',
    flavor: '山道を毎朝走り、荷を一つも崩さず届けてきた配達人。',
    portrait: 'fujiwaratakumi',
    apt: { labor: 7, tech: 8, medical: 2, charm: 4 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'spirit_brawler',
    name: '表飯陽助',
    alias: '霊界帰りの喧嘩屋',
    flavor: '一度死んだと言い張る喧嘩屋。乱暴だが、困った者は放っておけない。',
    portrait: 'omotehanyosuke',
    apt: { labor: 9, tech: 3, medical: 3, charm: 7 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'radio_specialist',
    name: '草薙素人',
    alias: '自称素人の通信技師',
    flavor: '素人を名乗る通信技師。無線の雑音から人の声と嘘を拾う。',
    portrait: 'kusanagishiroto',
    apt: { labor: 4, tech: 9, medical: 4, charm: 7 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'eccentric_inventor',
    name: '平賀源外',
    alias: 'からくり学者',
    flavor: '壊れた道具を妙な仕掛けで蘇らせるが、半分は煙を噴く。',
    portrait: 'hiragagengai',
    apt: { labor: 4, tech: 9, medical: 3, charm: 6 },
    traits: ['troublemaker'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'reconstruction_planner',
    name: '後藤旧平',
    alias: '復興屋',
    flavor: '医者から役人へ転じ、災害の跡に新しい町の図面を引く。',
    portrait: 'gotokyuhei',
    apt: { labor: 3, tech: 7, medical: 6, charm: 8 },
    traits: ['leader'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'warning_headman',
    name: '浜口五稜',
    alias: '火を放つ庄屋',
    flavor: '津波を知らせるため、自分の稲束に火を放った庄屋。',
    portrait: 'hamaguchigoryo',
    apt: { labor: 8, tech: 5, medical: 3, charm: 8 },
    traits: ['sturdy'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'mountain_postman',
    name: '前島粗',
    alias: '山越えの郵便屋',
    flavor: '道が閉ざされても手紙と荷物を届ける、段取り好きの郵便屋。',
    portrait: 'maejimaaraso',
    apt: { labor: 7, tech: 6, medical: 3, charm: 7 },
    traits: ['hard_worker'],
    condition: 'healthy',
    xp: 0,
  },
  {
    id: 'poor_writer',
    name: '樋口二葉',
    alias: '貧乏な物書き',
    flavor: '貧しい暮らしを切り詰めながら、町の人々を物語に書き留める。',
    portrait: 'higuchifutaba',
    apt: { labor: 3, tech: 6, medical: 3, charm: 9 },
    traits: ['popular'],
    condition: 'healthy',
    xp: 0,
  },
]

export const UNIQUE_UNITS: Unit[] = UNIQUE_UNIT_DEFS.map((u) => ({ ...u, unique: true }))

export const RANDOM_PORTRAIT_IDS = [
  'recruit_workwear_a',
  'recruit_workwear_b',
  'recruit_utility_a',
  'recruit_utility_b',
  'recruit_care_a',
  'recruit_care_b',
  'recruit_townsfolk_a',
  'recruit_townsfolk_b',
] as const

export function selectRandomPortrait(
  seed: number,
  unitId: string,
  usedPortraits: readonly string[],
): string {
  const available = RANDOM_PORTRAIT_IDS.filter((id) => !usedPortraits.includes(id))
  const pool = available.length > 0 ? available : [...RANDOM_PORTRAIT_IDS]
  let h = seed
  for (let i = 0; i < unitId.length; i++) {
    h = Math.imul(h ^ unitId.charCodeAt(i), 0x9e3779b9)
  }
  h = (h ^ (h >>> 16)) >>> 0
  return pool[h % pool.length]!
}

const ALIAS_BY_APT: Record<Aptitude, string> = {
  labor: '力自慢',
  tech: '発明家',
  medical: '薬草通',
  charm: '人たらし',
}

export function cloneUnit(unit: Unit, id = unit.id): Unit {
  return { ...unit, id, apt: { ...unit.apt }, traits: [...unit.traits] }
}

export function makeRandomUnit(
  rng: RngState,
  taken: string[],
  usedPortraits: readonly string[] = [],
): { unit: Unit; rng: RngState } {
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
    portrait: selectRandomPortrait(rng.seed, id, usedPortraits),
    apt,
    traits,
    condition: 'healthy',
    xp: 0,
  }
  return { unit, rng: r }
}
