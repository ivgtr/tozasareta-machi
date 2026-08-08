import { describe, expect, it } from 'vitest'
import {
  NO_INSETS,
  deviceClassOf,
  designSizeOf,
  guardSafeInsets,
  toLogicalSafeInsets,
} from '../src/scene/layout'
import { computeRegions } from '../src/scene/regions'
import { colorCss, colorNum } from '../src/scene/tokens'

describe('deviceClassOf', () => {
  it('900px 以上が wide', () => {
    expect(deviceClassOf(899)).toBe('narrow')
    expect(deviceClassOf(900)).toBe('wide')
    expect(deviceClassOf(1280)).toBe('wide')
    expect(deviceClassOf(390)).toBe('narrow')
  })
})

describe('designSizeOf', () => {
  it('docs/22 §4.4 の設計サイズ', () => {
    expect(designSizeOf('wide')).toEqual({ width: 1280, height: 720 })
    expect(designSizeOf('narrow')).toEqual({ width: 480, height: 854 })
  })
})

describe('safe-area conversion', () => {
  it('canvas外の余白を差し引いてlogical座標へ変換する', () => {
    const insets = toLogicalSafeInsets(
      { top: 30, right: 20, bottom: 10, left: 30 },
      400,
      800,
      { left: 20, top: 10, right: 380, bottom: 790, width: 360, height: 780 },
      480,
      854,
    )
    expect(insets.left).toBeCloseTo((10 * 480) / 360)
    expect(insets.right).toBe(0)
    expect(insets.top).toBeCloseTo((20 * 854) / 780)
    expect(insets.bottom).toBe(0)
  })

  it('safe-area が存在する辺だけ最低8pxの操作ガードを確保する', () => {
    expect(guardSafeInsets({ top: 4, right: 0, bottom: 12, left: 1 })).toEqual({
      top: 8,
      right: 0,
      bottom: 12,
      left: 8,
    })
  })
})

describe('computeRegions', () => {
  it('wide は町を拡大し、人物デッキと計画操作を同じ下段に置く', () => {
    const r = computeRegions('wide', 1280, 720, NO_INSETS)
    expect(r.hud).toEqual({ x: 0, y: 0, width: 1280, height: 56 })
    expect(r.town).toEqual({ x: 0, y: 56, width: 1280, height: 536 })
    expect(r.deck).toEqual({ x: 0, y: 592, width: 912, height: 128 })
    expect(r.controls).toEqual({ x: 920, y: 592, width: 360, height: 128 })
    expect(r.deck.y).toBe(r.controls.y)
  })

  it('narrow は町・人物デッキ・計画操作を縦に積む', () => {
    const r = computeRegions('narrow', 480, 854, NO_INSETS)
    expect(r.hud).toEqual({ x: 0, y: 0, width: 480, height: 52 })
    expect(r.town).toEqual({ x: 0, y: 52, width: 480, height: 620 })
    expect(r.deck).toEqual({ x: 0, y: 672, width: 480, height: 118 })
    expect(r.controls).toEqual({ x: 0, y: 790, width: 480, height: 64 })
  })

  it('基本領域はpresentation modeに依存せず安定する', () => {
    const first = computeRegions('wide', 1280, 720, NO_INSETS)
    const second = computeRegions('wide', 1280, 720, NO_INSETS)
    expect(second).toEqual(first)
  })

  it('セーフエリア inset があるときのみ 8px ガードが効く', () => {
    const plain = computeRegions('wide', 1280, 720, NO_INSETS)
    expect(plain.hud.y).toBe(0)
    const notched = computeRegions('wide', 1280, 720, {
      top: 20,
      right: 0,
      bottom: 12,
      left: 0,
    })
    expect(notched.hud.y).toBe(20)
    expect(notched.controls.y + notched.controls.height + 12).toBe(720)
    expect(notched.deck.y).toBe(notched.controls.y)
    const tiny = computeRegions('wide', 1280, 720, { top: 4, right: 0, bottom: 0, left: 0 })
    expect(tiny.hud.y).toBe(8)
  })
})

describe('tokens', () => {
  it('colorCss / colorNum は往復する', () => {
    expect(colorCss(0x0a0e24)).toBe('#0a0e24')
    expect(colorNum('#ffc857')).toBe(0xffc857)
    expect(colorCss(colorNum('#5ee6a8'))).toBe('#5ee6a8')
  })
})
