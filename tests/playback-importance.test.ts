import { describe, expect, it } from 'vitest'
import type { Effect } from '../src/game/types'
import {
  deriveBeatImportance,
  deriveBeatPresentation,
  PLAYBACK_TIMING,
} from '../src/scene/playback/beat-presentation'
import type { FlowBeat } from '../src/scene/playback/beats'

function flow(source: string, effects: Effect[], actorIds: string[] = []): FlowBeat {
  return { kind: 'flow', source, effects, actorIds }
}

function effect(target: Effect['target'], delta: number, reason = '変化'): Effect {
  return { day: 1, source: 'settlement', target, delta, reason }
}

describe('playback importance', () => {
  it('日次清算をminor、通常作業をnormalとして導出する', () => {
    expect(deriveBeatImportance(flow('settlement', [effect('food', -8)]))).toBe('minor')
    expect(
      deriveBeatImportance(flow('task:repair_power', [effect('power', 14)], ['engineer'])),
    ).toBe('normal')
  })

  it('死亡・局面転換・大幅変化・加入をmajorとして導出する', () => {
    expect(deriveBeatImportance(flow('act_final', [effect('morale', 0)]))).toBe('major')
    expect(deriveBeatImportance(flow('task:restore_road', [effect('food', 28)]))).toBe('major')
    expect(deriveBeatImportance(flow('settlement', [effect('flag:casualties', 1)]))).toBe('major')
    expect(
      deriveBeatImportance({ kind: 'arrival', unitId: 'u1', effects: [effect('morale', 2)] }),
    ).toBe('major')
  })

  it('重要度ごとに自動進行時間を変え、reduced-motionでは静的な共通時間にする', () => {
    const minor = flow('settlement', [effect('food', -8)])
    const normal = flow('task:repair_power', [effect('power', 14)])
    const major = flow('task:restore_road', [effect('food', 28)])

    expect(deriveBeatPresentation(minor, false).durationMs).toBe(PLAYBACK_TIMING.minorMs)
    expect(deriveBeatPresentation(normal, false).durationMs).toBe(PLAYBACK_TIMING.normalMs)
    expect(deriveBeatPresentation(major, false).durationMs).toBe(PLAYBACK_TIMING.majorMs)
    expect(deriveBeatPresentation(major, true).durationMs).toBe(PLAYBACK_TIMING.reducedMs)
  })
})
