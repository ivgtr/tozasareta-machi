// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from '../src/ui/App'
import { ChoiceOverlay } from '../src/ui/components/ChoiceOverlay'
import { TitleScreen } from '../src/ui/screens/TitleScreen'
import { createInitialState } from '../src/game/state'
import { choiceOptions, findEvent } from '../src/game/events'
import type { GameState } from '../src/game/types'

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
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))
    const { container } = render(<App />)
    expect(screen.getByText(/緊急派遣要請/)).toBeTruthy()
    expect(container.querySelector('.type-text__reserve')).not.toBeNull()
    const briefing = screen.getByRole('button', { name: '文章を全文表示' })
    fireEvent.click(briefing)
    expect(container.querySelector('.type-text__visible')?.textContent).toMatch(/生かし続けよ/)
    expect(screen.queryByText('続きから')).toBeNull()
  })

  it('セーブがあれば続きからを主操作として同じ寸法の開始ボタンを表示する', () => {
    const { container } = render(<TitleScreen onNewGame={() => {}} onResume={() => {}} canResume />)
    expect(screen.getByText('▶ 続きから')).toBeTruthy()
    expect(screen.getByText('最初から')).toBeTruthy()
    expect(screen.queryByText('▶ 指揮所へ')).toBeNull()
    expect(container.querySelectorAll('.title__game-action')).toHaveLength(2)
    const gameActions = container.querySelector('.title__game-actions')
    expect(gameActions).not.toBeNull()
    expect(gameActions!.contains(screen.getByText(/演出:/))).toBe(false)
  })
})

describe('play', () => {
  it('3ゾーンと町の様子・4任務・初期4ユニットが描画される', () => {
    const { container } = startGame()
    for (const t of ['町の状況', '本日の対応', '本部記録', '町の様子'])
      expect(screen.getByText(t)).toBeTruthy()
    expect(container.querySelector('.play__town-view .skyline')).not.toBeNull()
    expect(container.querySelector('.play__footer')).toBeNull()
    for (const t of ['発電所の修理', '道路復旧', '医療班増員', '炊き出し'])
      expect(screen.getByText(t)).toBeTruthy()
    for (const u of ['真壁史子', '榊直人', '森レナ', '岩倉源造'])
      expect(screen.getByText(u)).toBeTruthy()
    expect(container.querySelectorAll('.unit-card .pixel-art')).toHaveLength(4)
  })

  it('ユニットを選択→任務クリックで配置され、未配置数が減る', () => {
    startGame()
    expect(screen.getByText('4人 未配置')).toBeTruthy()
    fireEvent.click(screen.getByText('岩倉源造'))
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
    const card = screen.getByText('岩倉源造').closest('.unit-card')
    expect(card).not.toBeNull()
    fireEvent.click(card!.querySelector('.unit-card__info')!)
    expect(screen.getByText(/負傷しない/)).toBeTruthy()
    expect(screen.getByText(/元消防団長/)).toBeTruthy()
  })

  it('待機カードはコンパクトで得意適性バッジが表示される', () => {
    const { container } = startGame()
    expect(container.querySelector('.unit-card--compact')).not.toBeNull()
    expect(container.querySelector('.unit-card__apt-badge')).not.toBeNull()
  })

  it('備蓄不足で炊き出しが支払不能と表示され、配置が拒否される', () => {
    const { container } = startGame()
    const dismissChoice = () => {
      const opt = container.querySelector<HTMLElement>('.choice-overlay__option')
      if (opt) fireEvent.click(opt)
    }
    for (let d = 0; d < 3; d++) {
      fireEvent.click(screen.getByText('岩倉源造'))
      fireEvent.click(screen.getByText('炊き出し'))
      fireEvent.click(screen.getByText('作戦を開始する'))
      fireEvent.click(screen.getByText('このまま開始'))
      dismissChoice()
    }
    expect(screen.getByText(/（不足）/)).toBeTruthy()
    fireEvent.click(screen.getByText('岩倉源造'))
    fireEvent.click(screen.getByText('炊き出し'))
    expect(screen.getByText('4人 未配置')).toBeTruthy()
  })
})

describe('choice overlay', () => {
  it('探索イベントでユニットごとの選択肢が表示される', () => {
    const s: GameState = { ...createInitialState(1), day: 6 }
    const expedition = findEvent('expedition')!
    const opts = choiceOptions(s, expedition)
    const state: GameState = {
      ...s,
      phase: 'choice',
      pendingChoice: { eventId: 'expedition', optionIds: opts.map((o) => o.id) },
    }
    const { container } = render(<ChoiceOverlay state={state} onChoose={() => {}} />)
    const unitBtns = container.querySelectorAll('.choice-overlay__unit')
    const otherBtns = container.querySelectorAll('.choice-overlay__option')
    expect(unitBtns.length).toBe(s.units.length)
    expect(otherBtns.length).toBe(1)
  })
})
