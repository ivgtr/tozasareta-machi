import { describe, expect, it } from 'vitest'
import type { Effect } from '../src/game/types'
import type { Beat } from '../src/scene/playback/beats'
import {
  derivePresentationMode,
  PresentationDirector,
  type PresentationInput,
} from '../src/scene/presentation'

const effect: Effect = {
  day: 1,
  source: 'task:repair_power',
  target: 'power',
  delta: 1,
  reason: 'test',
}

function input(overrides: Partial<PresentationInput> = {}): PresentationInput {
  return {
    state: { phase: 'planning' },
    beat: undefined,
    selectedUnitId: null,
    selectedFacility: null,
    ...overrides,
  }
}

function beat(kind: Beat['kind']): Beat {
  if (kind === 'flow') return { kind, effects: [effect] }
  if (kind === 'event') return { kind, id: 'test_event', effects: [effect] }
  return { kind, unitId: 'u1', effects: [effect] }
}

describe('derivePresentationMode', () => {
  it('通常時は選択状態から focus presentation を導出する', () => {
    expect(derivePresentationMode(input())).toBe('planning')
    expect(derivePresentationMode(input({ selectedUnitId: 'u1' }))).toBe('unit-focus')
    expect(derivePresentationMode(input({ selectedFacility: 'power' }))).toBe('facility-focus')
  })

  it('ゲームphaseは通常の選択状態より優先する', () => {
    const choice = input({ state: { phase: 'choice' }, selectedUnitId: 'u1' })
    const ending = input({ state: { phase: 'ended' }, selectedFacility: 'power' })

    expect(derivePresentationMode(choice)).toBe('choice')
    expect(derivePresentationMode(ending)).toBe('ending')
  })

  it('再生beatはphaseより優先して現在の演出を表す', () => {
    const flow = input({ state: { phase: 'choice' }, beat: beat('flow') })
    const event = input({ state: { phase: 'ended' }, beat: beat('event') })
    const arrival = input({ state: { phase: 'choice' }, beat: beat('arrival') })

    expect(derivePresentationMode(flow)).toBe('flow')
    expect(derivePresentationMode(event)).toBe('event')
    expect(derivePresentationMode(arrival)).toBe('arrival')
  })
})

describe('PresentationDirector', () => {
  it('mode変更と詳細表示を一箇所で管理する', () => {
    const director = new PresentationDirector()

    expect(director.resolve(input())).toEqual({
      mode: 'planning',
      changed: false,
      showDetail: false,
    })
    expect(director.resolve(input({ selectedUnitId: 'u1' }))).toEqual({
      mode: 'unit-focus',
      changed: true,
      showDetail: true,
    })
    expect(director.mode).toBe('unit-focus')
    expect(director.resolve(input({ beat: beat('event') }))).toEqual({
      mode: 'event',
      changed: true,
      showDetail: false,
    })
  })
})
