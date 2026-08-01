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

const dayNum = (container: HTMLElement) => container.querySelector('.play__day-num')?.textContent

describe('title', () => {
  it('ブリーフィングが表示され、セーブなしでは続きからが出ない', () => {
    render(<App />)
    expect(screen.getByText(/緊急派遣要請/)).toBeTruthy()
    expect(screen.queryByText('続きから')).toBeNull()
  })
})

describe('play', () => {
  it('3ゾーンと4任務・初期4ユニットが描画される', () => {
    startGame()
    for (const t of ['町の状況', '本日の対応', '本部記録']) expect(screen.getByText(t)).toBeTruthy()
    for (const t of ['発電所の修理', '道路復旧', '医療班増員', '炊き出し'])
      expect(screen.getByText(t)).toBeTruthy()
    for (const u of ['嘉悦', '医師', '技術者', '農夫']) expect(screen.getByText(u)).toBeTruthy()
  })

  it('ユニットを選択→任務クリックで配置され、未配置数が減る', () => {
    startGame()
    expect(screen.getByText('4人 未配置')).toBeTruthy()
    fireEvent.click(screen.getByText('農夫'))
    fireEvent.click(screen.getByText('道路復旧'))
    expect(screen.getByText('3人 未配置')).toBeTruthy()
  })

  it('おまかせ配置で全員が配置される', () => {
    startGame()
    fireEvent.click(screen.getByText('おまかせ配置'))
    expect(screen.queryByText(/人 未配置/)).toBeNull()
  })

  it('リセットで配置が解除される', () => {
    startGame()
    fireEvent.click(screen.getByText('おまかせ配置'))
    fireEvent.click(screen.getByText('リセット'))
    expect(screen.getByText('4人 未配置')).toBeTruthy()
  })

  it('未配置がいると確認が入り、了承で日が進む', () => {
    const { container } = startGame()
    fireEvent.click(screen.getByText('作戦を開始する'))
    expect(screen.getByText('4人の人員が未配置です')).toBeTruthy()
    fireEvent.click(screen.getByText('このまま開始'))
    expect(dayNum(container)).toBe('2')
  })

  it('全員配置なら確認なしで日が進む', () => {
    const { container } = startGame()
    fireEvent.click(screen.getByText('おまかせ配置'))
    fireEvent.click(screen.getByText('作戦を開始する'))
    expect(dayNum(container)).toBe('2')
  })

  it('ユニットの詳細モーダルで特性の説明が見える', () => {
    startGame()
    const card = screen.getByText('農夫').closest('.unit-card')
    expect(card).not.toBeNull()
    fireEvent.click(card!.querySelector('.unit-card__info')!)
    expect(screen.getByText(/負傷しない/)).toBeTruthy()
  })
})
