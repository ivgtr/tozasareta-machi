import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaybackController } from '../src/scene/playback/playback'
import { PLAYBACK_TIMING } from '../src/scene/playback/beat-presentation'
import { buildBeats, playbackContextForPlan } from '../src/scene/playback/beats'
import { createInitialState } from '../src/game/state'
import type { DayPlan, Effect } from '../src/game/types'

const stubMotion = (reduced: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced ? query.includes('reduce') : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))

const flowEffects: Effect[] = [
  { day: 1, source: 'task:restore_road', target: 'food', delta: 16, reason: '食料を搬入した' },
  { day: 1, source: 'settlement', target: 'morale', delta: -3, reason: '不安が広がった' },
]

const eventEffects: Effect[] = [
  { day: 1, source: 'task:restore_road', target: 'food', delta: 16, reason: '食料を搬入した' },
  { day: 1, source: 'event:infection', target: 'medical', delta: -15, reason: '感染症が広がった' },
  {
    day: 1,
    source: 'event:infection',
    target: 'morale',
    delta: -10,
    reason: '不安で士気が下がった',
  },
]

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('buildBeats', () => {
  it('同一行動の複数効果を担当人物つきの1フロービートにまとめる', () => {
    const plan: DayPlan = {
      placements: [{ task: 'repair_power', unitIds: ['engineer', 'mayor'] }],
      ration: false,
      procure: false,
    }
    const effects: Effect[] = [
      {
        day: 1,
        source: 'task:repair_power',
        target: 'budget',
        delta: -10,
        reason: '予算を使った',
      },
      {
        day: 1,
        source: 'task:repair_power',
        target: 'power',
        delta: 18,
        reason: '発電設備を修理した',
      },
    ]

    const beats = buildBeats(effects, playbackContextForPlan(plan))
    expect(beats).toHaveLength(1)
    const beat = beats[0]
    expect(beat?.kind).toBe('flow')
    if (beat?.kind === 'flow') {
      expect(beat.source).toBe('task:repair_power')
      expect(beat.actorIds).toEqual(['engineer', 'mayor'])
      expect(beat.effects).toHaveLength(2)
    }
  })

  it('同一イベントの複数効果は1ビートにまとまる', () => {
    const beats = buildBeats(eventEffects)
    expect(beats).toHaveLength(2)
    expect(beats[0]?.kind).toBe('flow')
    const second = beats[1]
    expect(second?.kind).toBe('event')
    if (second?.kind === 'event') {
      expect(second.id).toBe('infection')
      expect(second.effects).toHaveLength(2)
    }
  })

  it('unit ターゲットを持つ探索帰還は arrival ビートになる', () => {
    const effects: Effect[] = [
      {
        day: 5,
        source: 'event:expedition_return',
        target: 'unit:farmer',
        delta: 0,
        reason: '探索から帰還した',
      },
      {
        day: 5,
        source: 'event:expedition_return',
        target: 'food',
        delta: 12,
        reason: '食料を持ち帰った',
      },
    ]
    const beats = buildBeats(effects)
    expect(beats).toHaveLength(1)
    const beat = beats[0]
    expect(beat?.kind).toBe('arrival')
    if (beat?.kind === 'arrival') {
      expect(beat.unitId).toBe('farmer')
      expect(beat.effects).toHaveLength(2)
    }
  })
})

describe('PlaybackController', () => {
  it('フローは行動単位で進み、完了で null に戻る', () => {
    stubMotion(false)
    const controller = new PlaybackController()
    controller.start(createInitialState(1), flowEffects)
    expect(controller.current?.index).toBe(0)

    vi.advanceTimersByTime(PLAYBACK_TIMING.normalMs)
    expect(controller.current?.index).toBe(1)

    vi.advanceTimersByTime(PLAYBACK_TIMING.minorMs)
    expect(controller.current).toBeNull()
  })

  it('イベントビートはポーズし、confirm で進む', () => {
    stubMotion(false)
    const controller = new PlaybackController()
    controller.start(createInitialState(1), eventEffects)

    vi.advanceTimersByTime(PLAYBACK_TIMING.normalMs)
    expect(controller.current?.index).toBe(1)
    expect(controller.waiting).toBe(true)

    vi.advanceTimersByTime(PLAYBACK_TIMING.normalMs * 3)
    expect(controller.current?.index).toBe(1)

    controller.confirm()
    vi.advanceTimersByTime(PLAYBACK_TIMING.afterConfirmMs)
    expect(controller.current).toBeNull()
  })

  it('フロースキップは次のStoryビートで止まり、イベントを消さない', () => {
    stubMotion(false)
    const controller = new PlaybackController()
    controller.start(createInitialState(1), eventEffects)

    controller.skipFlow()
    expect(controller.current?.index).toBe(1)
    expect(controller.beat?.kind).toBe('event')
    expect(controller.waiting).toBe(true)
  })

  it('cancel は再生全体を即座に破棄する', () => {
    stubMotion(false)
    const controller = new PlaybackController()
    controller.start(createInitialState(1), flowEffects)
    controller.cancel()
    expect(controller.current).toBeNull()
  })

  it('pause は現在のビートを時間経過で進めない', () => {
    stubMotion(true)
    const controller = new PlaybackController()
    controller.start(createInitialState(1), flowEffects)
    controller.pause()

    vi.advanceTimersByTime(PLAYBACK_TIMING.reducedMs * 2)
    expect(controller.current?.index).toBe(0)
  })

  it('reduced-motion でも内容を省略せず、短い静的表示として再生する', () => {
    stubMotion(true)
    const controller = new PlaybackController()
    controller.start(createInitialState(1), flowEffects)
    expect(controller.current?.index).toBe(0)
    expect(controller.current?.reduced).toBe(true)

    vi.advanceTimersByTime(PLAYBACK_TIMING.reducedMs)
    expect(controller.current?.index).toBe(1)
  })
})
