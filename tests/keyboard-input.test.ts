import { describe, expect, it } from 'vitest'
import { gameShortcutOf } from '../src/scene/input/keyboard'

function event(code: string, patch: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    code,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    repeat: false,
    target: null,
    ...patch,
  } as KeyboardEvent
}

describe('keyboard input', () => {
  it('主要操作を安定したshortcutへ変換する', () => {
    expect(gameShortcutOf(event('Escape'))).toBe('escape')
    expect(gameShortcutOf(event('Space'))).toBe('commit')
    expect(gameShortcutOf(event('KeyA'))).toBe('auto-assign')
    expect(gameShortcutOf(event('KeyL'))).toBe('log')
    expect(gameShortcutOf(event('KeyM'))).toBe('menu')
    expect(gameShortcutOf(event('ArrowLeft'))).toBe('previous')
    expect(gameShortcutOf(event('ArrowRight'))).toBe('next')
    expect(gameShortcutOf(event('Enter'))).toBe('activate')
  })

  it('修飾キーと非移動キーのrepeatをゲーム操作へ流さない', () => {
    expect(gameShortcutOf(event('KeyA', { ctrlKey: true }))).toBeNull()
    expect(gameShortcutOf(event('Space', { repeat: true }))).toBeNull()
    expect(gameShortcutOf(event('ArrowRight', { repeat: true }))).toBe('next')
    expect(gameShortcutOf(event('KeyQ'))).toBeNull()
  })
})
