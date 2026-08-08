import { describe, expect, it } from 'vitest'

const ASSETS = [
  'town/base.png',
  'facility/hq-normal.png',
  'facility/power-normal.png',
  'facility/power-low.png',
  'facility/power-working.png',
  'facility/road-collapsed.png',
  'facility/road-working.png',
  'facility/road-restored.png',
  'facility/clinic-normal.png',
  'facility/clinic-working.png',
  'facility/plaza-normal.png',
  'facility/plaza-working.png',
  'facility/warehouse-normal.png',
  'token/mayor.png',
  'token/medic.png',
  'token/engineer.png',
  'token/farmer.png',
  'token/recruit_workwear_a.png',
  'token/recruit_workwear_b.png',
  'token/recruit_utility_a.png',
  'token/recruit_utility_b.png',
  'token/recruit_care_a.png',
  'token/recruit_care_b.png',
  'token/recruit_townsfolk_a.png',
  'token/recruit_townsfolk_b.png',
] as const

const MODULES = {
  ...import.meta.glob('../src/assets/town/*.png'),
  ...import.meta.glob('../src/assets/facility/*.png'),
  ...import.meta.glob('../src/assets/token/*.png'),
}

describe('town art asset contract', () => {
  it('Phase 4の25点を単一の必須アセットセットとして持つ', () => {
    const actual = Object.keys(MODULES)
      .map((path) => path.replace('../src/assets/', ''))
      .sort()

    expect(ASSETS).toHaveLength(25)
    expect(actual).toEqual([...ASSETS].sort())
  })
})
