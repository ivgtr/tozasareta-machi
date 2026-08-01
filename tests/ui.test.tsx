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

const startGame = () => {
  const utils = render(<App />)
  fireEvent.click(screen.getByText('▶ 指揮所へ'))
  return utils
}

describe('title', () => {
  it('ブリーフィングが表示され、セーブなしでは続きからが出ない', () => {
    render(<App />)
    expect(screen.getByText(/緊急派遣要請/)).toBeTruthy()
    expect(screen.getByText(/臨時対策責任者/)).toBeTruthy()
    expect(screen.queryByText('続きから')).toBeNull()
  })

  it('指揮所へ でプレイ画面に遷移する', () => {
    startGame()
    expect(screen.getByText('町の状況')).toBeTruthy()
    expect(screen.getByText('本日の対応')).toBeTruthy()
  })
})

describe('play', () => {
  it('4つの任務が名前・効果つきで描画される', () => {
    startGame()
    for (const name of ['発電所の修理', '道路復旧', '医療班増員', '炊き出し']) {
      expect(screen.getByText(name)).toBeTruthy()
    }
    expect(screen.getByText('作業員プール')).toBeTruthy()
  })

  it('作戦を開始すると日が進む', () => {
    const { container } = startGame()
    const dayNum = () => container.querySelector('.play__day-num')?.textContent
    expect(dayNum()).toBe('1')
    fireEvent.click(screen.getByText('作戦を開始する'))
    expect(dayNum()).toBe('2')
  })

  it('任務をクリックすると作業員が配置され、undo で戻る', () => {
    const { container } = startGame()
    const slot = container.querySelector<HTMLElement>('[data-slot="restore_road"]')
    expect(slot).not.toBeNull()
    fireEvent.click(slot!)
    expect(slot!.querySelectorAll('.taskslot__token')).toHaveLength(1)
    fireEvent.click(screen.getByText('作戦を開始する'))
    fireEvent.click(screen.getByText('一手戻る'))
    expect(container.querySelector('.play__day-num')?.textContent).toBe('1')
  })
})
