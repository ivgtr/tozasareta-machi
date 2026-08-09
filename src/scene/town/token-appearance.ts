export const TOKEN_APPEARANCES = [
  'person_male_a',
  'person_male_b',
  'person_female_a',
  'person_female_b',
] as const

export type TokenAppearance = (typeof TOKEN_APPEARANCES)[number]

export const TOKEN_APPEARANCE_BY_PORTRAIT: Readonly<Record<string, TokenAppearance>> = {
  edogawakonnan: 'person_male_a',
  edomaru: 'person_male_b',
  engineer: 'person_female_a',
  farmer: 'person_male_b',
  fujiwaratakumi: 'person_male_a',
  gotokyuhei: 'person_male_b',
  hamaguchigoryo: 'person_male_a',
  higuchifutaba: 'person_female_b',
  hiragagengai: 'person_male_b',
  hoshinousagi: 'person_female_a',
  ikarishinji: 'person_male_a',
  inuinu: 'person_male_b',
  ishidasangiku: 'person_male_a',
  ishimichiku: 'person_male_b',
  kibunza: 'person_male_b',
  kochobareru: 'person_female_a',
  kusanagishiroto: 'person_male_a',
  maejimaaraso: 'person_male_b',
  manzaburo: 'person_male_a',
  masamune: 'person_male_b',
  matsuuraakeshi: 'person_male_b',
  mayor: 'person_female_a',
  medic: 'person_male_a',
  midoriyaizumi: 'person_male_a',
  minakatajinzo: 'person_male_b',
  miyamotomuzo: 'person_male_a',
  nantei: 'person_male_b',
  ninomiyasonzo: 'person_male_b',
  noguchieisei: 'person_male_a',
  omotehanyosuke: 'person_male_a',
  recruit_care_a: 'person_female_a',
  recruit_care_b: 'person_female_b',
  recruit_townsfolk_a: 'person_male_a',
  recruit_townsfolk_b: 'person_male_b',
  recruit_utility_a: 'person_male_b',
  recruit_utility_b: 'person_female_b',
  recruit_workwear_a: 'person_male_a',
  recruit_workwear_b: 'person_female_a',
  sanji: 'person_female_b',
  shidohiko: 'person_male_b',
  yoshidashoin: 'person_male_a',
  yuina: 'person_female_a',
}

export function hasTokenAppearance(portraitId: string): boolean {
  return portraitId in TOKEN_APPEARANCE_BY_PORTRAIT
}

export function tokenAppearanceOf(portraitId: string): TokenAppearance {
  return TOKEN_APPEARANCE_BY_PORTRAIT[portraitId] ?? 'person_male_a'
}
