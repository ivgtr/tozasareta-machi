import { describe, expect, it } from 'vitest'
import { applyEffects, splitEffects } from '../src/game/effects'
import { createInitialState } from '../src/game/state'
import type { Effect } from '../src/game/types'

describe('effect channels', () => {
  const effects: Effect[] = [
    { day: 1, source: 'test', target: 'food', delta: 5, reason: '食料増加' },
    {
      day: 1,
      source: 'test',
      target: 'flag:cooperation',
      delta: 1,
      reason: '協力増加',
    },
    { day: 1, source: 'test', target: 'flag:injury', delta: 0, reason: '負傷通知' },
    { day: 1, source: 'event:arrival', target: 'unit:farmer', delta: 0, reason: '到着通知' },
  ]

  it('状態変更と演出通知を別チャネルへ分類する', () => {
    const channels = splitEffects(effects)
    expect(channels.stateChanges.map((effect) => effect.target)).toEqual([
      'food',
      'flag:cooperation',
    ])
    expect(channels.notices.map((effect) => effect.target)).toEqual([
      'flag:injury',
      'unit:farmer',
    ])
  })

  it('状態適用時は通知チャネルを無視する', () => {
    const state = createInitialState(1)
    const applied = applyEffects(state, effects)
    expect(applied.resources.food).toBe(state.resources.food + 5)
    expect(applied.flags.cooperation).toBe(state.flags.cooperation + 1)
    expect(applied.units).toBe(state.units)
  })
})
