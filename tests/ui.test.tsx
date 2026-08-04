// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from '../src/ui/App'
import { ChoiceOverlay } from '../src/ui/components/ChoiceOverlay'
import { CompactStatus } from '../src/ui/components/CompactStatus'
import { DecisionBoard } from '../src/ui/components/DecisionBoard'
import { StatusWall } from '../src/ui/components/StatusWall'
import { TitleScreen } from '../src/ui/screens/TitleScreen'
import { createInitialState } from '../src/game/state'
import { choiceOptions, findEvent } from '../src/game/events'
import { BALANCE } from '../src/game/data/balance'
import type { GameState, Modifier } from '../src/game/types'
import { serializeStore } from '../src/ui/store'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
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
    expect(gameActions!.contains(screen.getByText(/文字送り・演出:/))).toBe(false)
  })

  it('文字送りと演出の設定状態をボタンで明示する', () => {
    render(<TitleScreen onNewGame={() => {}} onResume={() => {}} canResume={false} />)
    const enabled = screen.getByRole('button', { name: '文字送り・演出: ON' })
    expect(enabled.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(enabled)
    const disabled = screen.getByRole('button', { name: '文字送り・演出: OFF' })
    expect(disabled.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(disabled)
  })
})

describe('play', () => {
  it('コンパクト状況HUDに判断用の6資源を表示する', () => {
    const state: GameState = {
      ...createInitialState(1),
      resources: { food: 91, power: 82, medical: 73, morale: 64 },
      budget: 55,
      stockpile: 46,
    }
    const { container } = render(<CompactStatus state={state} />)
    const hud = screen.getByRole('region', { name: '資源状況' })
    expect(hud.querySelectorAll('.compact-status__item')).toHaveLength(6)
    expect(container.textContent).toContain('食料91')
    expect(container.textContent).toContain('電力82')
    expect(container.textContent).toContain('医療73')
    expect(container.textContent).toContain('士気64')
    expect(container.textContent).toContain('予算55')
    expect(container.textContent).toContain('備蓄46')
  })

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
    expect(container.querySelectorAll('.taskslot__units')).toHaveLength(0)
    expect(container.querySelector('.board__tools')).not.toBeNull()
    const commit = container.querySelector('.board__commitbar .board__commit')
    expect(commit).not.toBeNull()
    expect(commit!.classList.contains('pixel-button--primary')).toBe(false)
    expect(screen.getByText('4人 待機')).toBeTruthy()
  })

  it('ゲームメニューからタイトルへ戻り、1日目を再開できる', () => {
    startGame()
    expect(screen.queryByText('最初から')).toBeNull()
    const menuButton = screen.getByRole('button', { name: 'メニュー' })
    fireEvent.click(menuButton)
    expect(screen.getByRole('dialog', { name: 'ゲームメニュー' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'ゲームに戻る' }))
    fireEvent.click(screen.getByRole('button', { name: 'タイトルに戻る' }))
    expect(screen.getByText('▶ 続きから')).toBeTruthy()
    fireEvent.click(screen.getByText('▶ 続きから'))
    expect(screen.getByText('本日の対応')).toBeTruthy()
  })

  it('ゲームメニューはEscapeで閉じ、メニューボタンへフォーカスを戻す', () => {
    startGame()
    const menuButton = screen.getByRole('button', { name: 'メニュー' })
    fireEvent.click(menuButton)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'ゲームメニュー' })).toBeNull()
    expect(document.activeElement).toBe(menuButton)
  })

  it('ゲームメニュー内にフォーカスを留め、背景クリックで閉じる', () => {
    const { container } = startGame()
    fireEvent.click(screen.getByRole('button', { name: 'メニュー' }))
    const back = screen.getByRole('button', { name: 'ゲームに戻る' })
    const restart = screen.getByRole('button', { name: '最初から' })
    back.focus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(restart)
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(back)
    fireEvent.click(container.querySelector('.game-menu-overlay')!)
    expect(screen.queryByRole('dialog', { name: 'ゲームメニュー' })).toBeNull()
  })

  it('ゲームメニューから確認後に最初からやり直せる', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    startGame()
    fireEvent.click(screen.getByText('真壁史子'))
    fireEvent.click(screen.getByText('発電所の修理'))
    expect(screen.getByText('3人 待機')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'メニュー' }))
    fireEvent.click(screen.getByRole('button', { name: '最初から' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByText('4人 待機')).toBeTruthy()
  })

  it('選択イベント中のセーブをタイトルから再開できる', () => {
    cleanup()
    const base = createInitialState(1)
    const event = findEvent('expedition')!
    const options = choiceOptions({ ...base, day: 6 }, event)
    const state: GameState = {
      ...base,
      day: 6,
      phase: 'choice',
      pendingChoice: { eventId: event.id, optionIds: options.map((option) => option.id) },
    }
    localStorage.setItem('tozasareta-machi:save', serializeStore({ state, history: [] }))
    render(<App />)
    fireEvent.click(screen.getByText('▶ 続きから'))
    expect(screen.getByText('判断を求められている')).toBeTruthy()
  })

  it('ユニットを選択→任務クリックで配置され、未配置数が減る', () => {
    const { container } = startGame()
    expect(screen.getByText('4人 待機')).toBeTruthy()
    fireEvent.click(screen.getByText('岩倉源造'))
    fireEvent.click(screen.getByText('道路復旧'))
    expect(screen.getByText('3人 待機')).toBeTruthy()
    expect(container.querySelectorAll('.taskslot__units')).toHaveLength(1)
  })

  it('おまかせ配置で全員が配置される', () => {
    startGame()
    fireEvent.click(screen.getByText('おまかせ配置'))
    expect(screen.getByText('配置完了')).toBeTruthy()
    expect(document.querySelector('.board__commitbar--ready')).not.toBeNull()
  })

  it('リセットで配置が解除される', () => {
    startGame()
    fireEvent.click(screen.getByText('おまかせ配置'))
    fireEvent.click(screen.getByText('リセット'))
    expect(screen.getByText('4人 待機')).toBeTruthy()
  })

  it('未配置がいると確認が入り、了承で日が進む', () => {
    const { container } = startGame()
    fireEvent.click(screen.getByText('本日の対応を確定'))
    expect(screen.getByText('4人の人員が未配置です')).toBeTruthy()
    fireEvent.click(screen.getByText('このまま開始'))
    expect(dayNum(container)).toBe('2')
  })

  it('全員配置なら確認なしで日が進む', () => {
    const { container } = startGame()
    fireEvent.click(screen.getByText('おまかせ配置'))
    fireEvent.click(screen.getByText('本日の対応を確定'))
    expect(dayNum(container)).toBe('2')
  })

  it('再生中と終了後は配置補助・確定操作を無効化する', () => {
    const state = createInitialState(1)
    const { container, rerender } = render(<DecisionBoard state={state} busy onCommit={() => {}} />)
    expect(container.querySelector('.board--busy')).not.toBeNull()
    for (const name of ['おまかせ配置', 'リセット', '本日の対応を確定'])
      expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(true)

    rerender(<DecisionBoard state={{ ...state, phase: 'ended' }} onCommit={() => {}} />)
    for (const name of ['おまかせ配置', 'リセット', '本日の対応を確定'])
      expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(true)
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

  it('カードの選択と詳細を兄弟ボタンに分け、配置解除まで操作名で示す', () => {
    const { container } = startGame()
    const select = screen.getByRole('button', { name: '岩倉源造を選択' })
    const details = screen.getByRole('button', { name: '岩倉源造の詳細' })
    expect(select.parentElement).toBe(details.parentElement)
    expect(container.querySelector('.unit-card button button')).toBeNull()
    expect(select.getAttribute('aria-pressed')).toBe('false')
    select.focus()
    fireEvent.click(select, { detail: 0 })
    expect(select.getAttribute('aria-pressed')).toBe('true')

    const target = screen.getByRole('button', { name: /道路復旧：岩倉源造をここに配置/ })
    expect(target.tagName).toBe('BUTTON')
    target.focus()
    fireEvent.click(target, { detail: 0 })
    const remove = screen.getByRole('button', { name: '岩倉源造の配置を解除' })
    expect(remove).toBeTruthy()
    remove.focus()
    fireEvent.click(remove, { detail: 0 })
    expect(screen.getByText('4人 待機')).toBeTruthy()
  })

  it('任務は未選択と選択中の配置案内を切り替える', () => {
    startGame()
    expect(screen.getAllByText('待機中の人員を先に選択')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: '森レナを選択' }), { detail: 0 })
    expect(screen.getAllByText('森レナをここに配置 →')).toHaveLength(4)
  })

  it('通常配給と節約配給を状態として示し、作戦概要にも反映する', () => {
    startGame()
    const normal = screen.getByRole('button', { name: '配給方針：通常配給' })
    expect(normal.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(normal, { detail: 0 })
    const saving = screen.getByRole('button', {
      name: '配給方針：節約配給（食料温存・士気低下）',
    })
    expect(saving.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '本日の対応を確定' }), { detail: 0 })
    expect(screen.getByText('節約配給')).toBeTruthy()
  })

  it('予算不足で炊き出しが支払不能と表示され、配置が拒否される', () => {
    const s: GameState = {
      ...createInitialState(1),
      budget: BALANCE.tasks.soup_kitchen.budget - 1,
    }
    const { container } = render(<DecisionBoard state={s} onCommit={() => {}} />)
    const slot = container.querySelector('[data-slot="soup_kitchen"]')
    expect(slot).not.toBeNull()
    expect(slot!.textContent).toContain('（不足）')
    fireEvent.click(screen.getByText('岩倉源造'))
    fireEvent.click(screen.getByText('炊き出し'))
    expect(screen.getByText('4人 待機')).toBeTruthy()
  })
})

describe('modifier の UI 表示', () => {
  const typhoon: Modifier = {
    id: 'typhoon',
    daysLeft: 2,
    startDay: 8,
    effects: [
      { target: 'produce:repair_power', op: 'set', value: 0 },
      { target: 'produce:restore_road', op: 'set', value: 0 },
    ],
  }

  it('台風中は屋外任務が disabled 表示になり、配置が拒否される', () => {
    const s: GameState = { ...createInitialState(1), day: 9, modifiers: [typhoon] }
    const { container } = render(<DecisionBoard state={s} onCommit={() => {}} />)
    const disabledSlots = container.querySelectorAll('.taskslot--disabled')
    expect(disabledSlots).toHaveLength(2)
    expect(screen.getAllByText('台風接近（あと2日） 配置不可')).toHaveLength(2)
    fireEvent.click(screen.getByText('岩倉源造'))
    fireEvent.click(screen.getByText('道路復旧'))
    expect(screen.getByText('4人 待機')).toBeTruthy()
  })

  it('modifier バッジが StatusWall にラベルと残り日数で表示される', () => {
    const s: GameState = { ...createInitialState(1), day: 9, modifiers: [typhoon] }
    const { container } = render(<StatusWall state={s} />)
    expect(container.querySelector('.modbadge')).not.toBeNull()
    expect(screen.getByText('台風接近')).toBeTruthy()
    expect(screen.getByText('あと2日')).toBeTruthy()
  })

  it('modifier がなければバッジは表示されない', () => {
    const s: GameState = createInitialState(1)
    const { container } = render(<StatusWall state={s} />)
    expect(container.querySelector('.modbadge')).toBeNull()
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
