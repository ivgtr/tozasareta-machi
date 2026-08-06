import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaybackController } from '../src/scene/playback/playback'
import { UI_TIMING, buildBeats } from '../src/scene/playback/beats'
import { restartGame } from '../src/scene/restart'
import { createInitialState } from '../src/game/state'
import type { Effect } from '../src/game/types'

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
    const fx: Effect[] = [
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
    const beats = buildBeats(fx)
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
  it('フローは1ビートずつ進み、完了で null に戻る', () => {
    stubMotion(false)
    const c = new PlaybackController()
    c.start(createInitialState(1), flowEffects)
    expect(c.current?.index).toBe(0)

    vi.advanceTimersByTime(UI_TIMING.effectMs)
    expect(c.current?.index).toBe(1)

    vi.advanceTimersByTime(UI_TIMING.effectMs)
    expect(c.current).toBeNull()
  })

  it('イベントビートはポーズし、confirm で進む', () => {
    stubMotion(false)
    const c = new PlaybackController()
    c.start(createInitialState(1), eventEffects)

    vi.advanceTimersByTime(UI_TIMING.effectMs)
    expect(c.current?.index).toBe(1)
    expect(c.waiting).toBe(true)

    vi.advanceTimersByTime(UI_TIMING.effectMs * 3)
    expect(c.current?.index).toBe(1)

    c.confirm()
    vi.advanceTimersByTime(UI_TIMING.afterConfirmMs)
    expect(c.current).toBeNull()
  })

  it('skip で即座に終わる', () => {
    stubMotion(false)
    const c = new PlaybackController()
    c.start(createInitialState(1), flowEffects)
    c.skip()
    expect(c.current).toBeNull()
  })

  it('新規ゲーム開始時は再生を停止してから状態をリセットする', () => {
    stubMotion(false)
    const c = new PlaybackController()
    const dispatched: { type: 'newGame'; seed: number }[] = []
    c.start(createInitialState(1), flowEffects)

    restartGame(
      c,
      {
        dispatch: (action) => {
          expect(c.current).toBeNull()
          dispatched.push(action)
        },
      },
      7,
    )

    expect(dispatched).toEqual([{ type: 'newGame', seed: 7 }])
    vi.advanceTimersByTime(UI_TIMING.effectMs * 3)
    expect(c.current).toBeNull()
  })

  it('reduced-motion では再生しない', () => {
    stubMotion(true)
    const c = new PlaybackController()
    c.start(createInitialState(1), flowEffects)
    expect(c.current).toBeNull()
  })
})
