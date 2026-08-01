import { describe, expect, it } from 'vitest'
import { GAME_VERSION } from '../src/game/version'

describe('smoke', () => {
  it('ゲームコアのモジュールを読み込める', () => {
    expect(GAME_VERSION).toBe(1)
  })
})
