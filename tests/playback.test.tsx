// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePlayback } from '../src/ui/hooks/usePlayback'
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

const effects: Effect[] = [
  { day: 1, source: 'task:restore_road', target: 'food', delta: 16, reason: '食料を搬入した' },
  { day: 1, source: 'settlement', target: 'morale', delta: -3, reason: '不安が広がった' },
]

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('usePlayback', () => {
  it('時間を進めると1件ずつ再生され、完了で null に戻る', () => {
    stubMotion(false)
    const { result } = renderHook(() => usePlayback())
    act(() => result.current.start(createInitialState(1), effects))
    expect(result.current.pb?.index).toBe(0)

    act(() => vi.advanceTimersByTime(UI_TIMING.effectMs))
    expect(result.current.pb?.index).toBe(1)

    act(() => vi.advanceTimersByTime(UI_TIMING.effectMs))
    expect(result.current.pb?.index).toBe(2)

    act(() => vi.advanceTimersByTime(UI_TIMING.effectMs))
    expect(result.current.pb).toBeNull()
  })

  it('skip で即座に終わる', () => {
    stubMotion(false)
    const { result } = renderHook(() => usePlayback())
    act(() => result.current.start(createInitialState(1), effects))
    act(() => result.current.skip())
    expect(result.current.pb).toBeNull()
  })

  it('reduced-motion では再生しない', () => {
    stubMotion(true)
    const { result } = renderHook(() => usePlayback())
    act(() => result.current.start(createInitialState(1), effects))
    expect(result.current.pb).toBeNull()
  })
})
