export type ArtKind = 'icon' | 'event' | 'portrait' | 'ending' | 'briefing' | 'scene' | 'skyline'

export interface ArtSpec {
  kind: ArtKind
  id: string
  glyph: string
  color: string
  label: string
}

export const PALETTE = {
  amber: '#ffc857',
  red: '#ff5f66',
  green: '#5ee6a8',
  cyan: '#6fd8ff',
  gold: '#ffd94a',
  dim: '#9aa3cc',
} as const

const spec = (kind: ArtKind, id: string, glyph: string, color: string, label: string): ArtSpec => ({
  kind,
  id,
  glyph,
  color,
  label,
})

export const ART_SPECS: ArtSpec[] = [
  spec('icon', 'food', '食', PALETTE.amber, '食料'),
  spec('icon', 'power', '電', PALETTE.cyan, '電力'),
  spec('icon', 'medical', '医', PALETTE.green, '医療'),
  spec('icon', 'morale', '士', PALETTE.gold, '士気'),
  spec('icon', 'repair_power', '修', PALETTE.cyan, '発電所の修理'),
  spec('icon', 'restore_road', '道', PALETTE.amber, '道路復旧'),
  spec('icon', 'reinforce_medical', '救', PALETTE.green, '医療班増員'),
  spec('icon', 'soup_kitchen', '炊', PALETTE.gold, '炊き出し'),
  spec('icon', 'ration', '配', PALETTE.amber, '配給を絞る'),
  spec('icon', 'mayor', '長', PALETTE.gold, '町長'),
  spec('icon', 'medic', '医', PALETTE.green, '医師'),
  spec('icon', 'engineer', '工', PALETTE.cyan, '技術者'),
  spec('icon', 'alert_warning', '警', PALETTE.amber, '警戒'),
  spec('icon', 'alert_danger', '危', PALETTE.red, '危険'),
  spec('icon', 'status_ok', '安', PALETTE.green, '安定'),
  spec('icon', 'info', 'ｉ', PALETTE.cyan, '情報'),

  spec('event', 'elderly_illness', '病', PALETTE.amber, '高齢者の体調不良'),
  spec('event', 'generator_failure', '機', PALETTE.red, '発電機の故障'),
  spec('event', 'hidden_stockpile', '米', PALETTE.green, '隠し備蓄の発見'),
  spec('event', 'foraging', '糧', PALETTE.green, '食料の調達'),
  spec('event', 'power_restored', '発', PALETTE.cyan, '仮設発電の復旧'),
  spec('event', 'medical_donation', '薬', PALETTE.green, '医薬品の寄贈'),
  spec('event', 'road_collapse', '雨', PALETTE.red, '道路の再崩落'),
  spec('event', 'volunteers', '助', PALETTE.green, '住民の自主協力'),
  spec('event', 'ration_protest', '反', PALETTE.amber, '配分への反発'),
  spec('event', 'rescue_contact', '救', PALETTE.cyan, '救援隊からの連絡'),
  spec('event', 'infection', '感', PALETTE.red, '感染症の発生'),
  spec('event', 'protest', '議', PALETTE.amber, '抗議の集まり'),
  spec('event', 'blackout', '停', PALETTE.red, '大規模停電'),
  spec('event', 'water_shortage', '水', PALETTE.amber, '水の不足'),
  spec('event', 'theft', '盗', PALETTE.red, '窃盗事件'),
  spec('event', 'radio_repair', '無', PALETTE.cyan, '無線機の修復'),
  spec('event', 'childbirth', '生', PALETTE.green, '新しい命'),
  spec('event', 'elder_death', '悼', PALETTE.dim, '高齢者の死去'),
  spec('event', 'trader', '商', PALETTE.amber, '行商人の来訪'),
  spec('event', 'wildlife', '獣', PALETTE.red, '野生動物の出没'),
  spec('event', 'clear_weather', '晴', PALETTE.cyan, '天候の回復'),
  spec('event', 'landslide_warning', '山', PALETTE.amber, '土砂災害警戒'),

  spec('portrait', 'mayor', '長', PALETTE.gold, '真壁史子'),
  spec('portrait', 'medic', '医', PALETTE.green, '榊直人'),
  spec('portrait', 'engineer', '工', PALETTE.cyan, '森レナ'),
  spec('portrait', 'farmer', '農', PALETTE.amber, '岩倉源造'),

  spec('portrait', 'recruit_workwear_a', '作', PALETTE.amber, '汎用加入者・作業着A'),
  spec('portrait', 'recruit_workwear_b', '作', PALETTE.amber, '汎用加入者・作業着B'),
  spec('portrait', 'recruit_utility_a', '整', PALETTE.cyan, '汎用加入者・整備A'),
  spec('portrait', 'recruit_utility_b', '整', PALETTE.cyan, '汎用加入者・整備B'),
  spec('portrait', 'recruit_care_a', '救', PALETTE.green, '汎用加入者・救護A'),
  spec('portrait', 'recruit_care_b', '救', PALETTE.green, '汎用加入者・救護B'),
  spec('portrait', 'recruit_townsfolk_a', '住', PALETTE.gold, '汎用加入者・住民A'),
  spec('portrait', 'recruit_townsfolk_b', '住', PALETTE.gold, '汎用加入者・住民B'),

  spec('portrait', 'shidohiko', '技', PALETTE.cyan, 'シド彦'),
  spec('portrait', 'noguchieisei', '医', PALETTE.green, '野口栄世'),
  spec('portrait', 'midoriyaizumi', '労', PALETTE.amber, '緑谷出三'),
  spec('portrait', 'sanji', '炊', PALETTE.gold, '惨事'),
  spec('portrait', 'masamune', '鍛', PALETTE.amber, '政宗'),
  spec('portrait', 'yuina', '祈', PALETTE.green, '結菜'),
  spec('portrait', 'miyamotomuzo', '武', PALETTE.amber, '宮本武三'),
  spec('portrait', 'minakatajinzo', '医', PALETTE.green, '南方仁三'),
  spec('portrait', 'ishidasangiku', '政', PALETTE.cyan, '石田三菊'),
  spec('portrait', 'ishimichiku', '工', PALETTE.cyan, '石神千久'),
  spec('portrait', 'inuinu', '薬', PALETTE.green, '犬犬'),
  spec('portrait', 'matsuuraakeshi', '狩', PALETTE.amber, '松浦武四'),
  spec('portrait', 'yoshidashoin', '教', PALETTE.gold, '吉田松院'),
  spec('portrait', 'kochobareru', '毒', PALETTE.green, '胡蝶ばれる'),
  spec('portrait', 'ninomiyasonzo', '農', PALETTE.amber, '二宮尊三'),
  spec('portrait', 'edomaru', '錬', PALETTE.cyan, 'エド丸'),
  spec('portrait', 'hoshinousagi', '織', PALETTE.gold, '星野うさぎ'),
  spec('portrait', 'manzaburo', '船', PALETTE.amber, '万三郎'),
  spec('portrait', 'nantei', '灯', PALETTE.green, '夜鳴ケイ'),
  spec('portrait', 'kibunza', '商', PALETTE.gold, '紀文左'),

  spec('ending', 'full_recovery', '復', PALETTE.green, '完全復旧'),
  spec('ending', 'managed_sacrifice', '犠', PALETTE.amber, '管理された犠牲'),
  spec('ending', 'self_governance', '自治', PALETTE.cyan, '住民自治'),
  spec('ending', 'collapse', '壊', PALETTE.red, '崩壊'),

  spec('briefing', 'ops_map', '図', PALETTE.amber, '作戦地図'),

  spec('scene', 'night', '夜', PALETTE.cyan, '孤立した町の夜'),
  spec('skyline', 'town', '町', PALETTE.amber, '町のスカイライン'),
  spec('skyline', 'town_normal', '町', PALETTE.amber, '町のスカイライン（通常）'),
  spec('skyline', 'town_dark', '町', PALETTE.dim, '町のスカイライン（停電）'),
  spec('skyline', 'town_danger', '町', PALETTE.red, '町のスカイライン（危険）'),
]

const LOOKUP = new Map(ART_SPECS.map((s) => [`${s.kind}:${s.id}`, s]))

export function artSpec(kind: ArtKind, id: string): ArtSpec | undefined {
  return LOOKUP.get(`${kind}:${id}`)
}

export function specsByKind(kind: ArtKind): ArtSpec[] {
  return ART_SPECS.filter((s) => s.kind === kind)
}
