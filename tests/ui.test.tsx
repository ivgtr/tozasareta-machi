// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from '../src/ui/App'

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage?.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ui smoke', () => {
  it('プレイ画面の3ゾーンが描画される', () => {
    render(<App />)
    expect(screen.getByText('町の状況')).toBeTruthy()
    expect(screen.getByText('本日の対応')).toBeTruthy()
    expect(screen.getByText('本部記録')).toBeTruthy()
    expect(screen.getByText('作戦を開始する')).toBeTruthy()
  })

  it('作戦を開始すると日が進ぶ', () => {
    const { container } = render(<App />)
    const dayNum = () => container.querySelector('.play__day-num')?.textContent
    expect(dayNum()).toBe('1')
    fireEvent.click(screen.getByText('作戦を開始する'))
    expect(dayNum()).toBe('2')
  })

  it('任務をクリックすると作業員が配置され、undo で戻る', () => {
    const { container } = render(<App />)
    const slot = container.querySelector<HTMLElement>('[data-slot="restore_road"]')
    expect(slot).not.toBeNull()
    fireEvent.click(slot!)
    expect(slot!.querySelectorAll('.taskslot__token')).toHaveLength(1)
    fireEvent.click(screen.getByText('作戦を開始する'))
    fireEvent.click(screen.getByText('一手戻る'))
    expect(container.querySelector('.play__day-num')?.textContent).toBe('1')
  })
})
