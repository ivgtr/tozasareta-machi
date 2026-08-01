// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { buildBeats, usePlayback } from '../src/ui/hooks/usePlayback'
import { createInitialState } from '../src/game/state'
import { UI_TIMING } from '../src/ui/data/ui-timing'
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
  { day: 1, source: 'event:infection', target: 'morale', delta: -10, reason: '不安で士気が下がった' },
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
})

describe('usePlayback', () => {
  it('フローは1ビートずつ進み、完了で null に戻る', () => {
    stubMotion(false)
    const { result } = renderHook(() => usePlayback())
    act(() => result.current.start(createInitialState(1), flowEffects))
    expect(result.current.pb?.index).toBe(0)

    act(() => vi.advanceTimersByTime(UI_TIMING.effectMs))
    expect(result.current.pb?.index).toBe(1)

    act(() => vi.advanceTimersByTime(UI_TIMING.effectMs))
    expect(result.current.pb).toBeNull()
  })

  it('イベントビートはポーズし、confirm で進む', () => {
    stubMotion(false)
    const { result } = renderHook(() => usePlayback())
    act(() => result.current.start(createInitialState(1), eventEffects))

    act(() => vi.advanceTimersByTime(UI_TIMING.effectMs))
    expect(result.current.pb?.index).toBe(1)
    expect(result.current.waiting).toBe(true)

    act(() => vi.advanceTimersByTime(UI_TIMING.effectMs * 3))
    expect(result.current.pb?.index).toBe(1)

    act(() => result.current.confirm())
    act(() => vi.advanceTimersByTime(UI_TIMING.afterConfirmMs))
    expect(result.current.pb).toBeNull()
  })

  it('skip で即座に終わる', () => {
    stubMotion(false)
    const { result } = renderHook(() => usePlayback())
    act(() => result.current.start(createInitialState(1), flowEffects))
    act(() => result.current.skip())
    expect(result.current.pb).toBeNull()
  })

  it('reduced-motion では再生しない', () => {
    stubMotion(true)
    const { result } = renderHook(() => usePlayback())
    act(() => result.current.start(createInitialState(1), flowEffects))
    expect(result.current.pb).toBeNull()
  })
})
