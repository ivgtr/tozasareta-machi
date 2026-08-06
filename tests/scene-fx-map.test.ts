import { describe, expect, it } from 'vitest'
import { EVENTS } from '../src/game/data/events-data'
import { PHYSICAL_TASKS } from '../src/game/actions'
import { hasExplicitFx, resolveFx } from '../src/scene/town/fx-map'

function knownSources(): string[] {
  return [
    ...PHYSICAL_TASKS.map((t) => `task:${t}`),
    'task:ration',
    'task:procure',
    'settlement',
    'act_stalemate',
    'act_final',
    ...EVENTS.map((e) => `event:${e.id}`),
    'event:expedition_return',
  ]
}

describe('fx対応表の網羅性', () => {
  it('既知 source がすべて対応表に掲載されている', () => {
    for (const s of knownSources()) {
      expect(hasExplicitFx(s), s).toBe(true)
    }
  })

  it('任務 source は docs/22 §5.2 の施設対応と一致する', () => {
    expect(resolveFx('task:repair_power', 'power').facility).toBe('power')
    expect(resolveFx('task:restore_road', 'food').facility).toBe('road')
    expect(resolveFx('task:reinforce_medical', 'medical').facility).toBe('clinic')
    expect(resolveFx('task:soup_kitchen', 'morale').facility).toBe('plaza')
    expect(resolveFx('task:ration', 'food').facility).toBe('warehouse')
    expect(resolveFx('task:procure', 'stockpile').facility).toBe('warehouse')
  })

  it('unit ターゲットは町の入口（road）へ接続する', () => {
    expect(resolveFx('event:expedition_return', 'unit:farmer')).toEqual({
      facility: 'road',
      kind: 'arrival',
    })
  })

  it('未対応 source は汎用浮遊表示へフォールバックする', () => {
    const entry = resolveFx('event:unknown_future_event', 'morale')
    expect(entry.facility).toBeNull()
    expect(entry.kind).toBe('float')
  })
})
