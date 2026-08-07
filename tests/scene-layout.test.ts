import { describe, expect, it } from 'vitest'
import { NO_INSETS, deviceClassOf, designSizeOf, toLogicalSafeInsets } from '../src/scene/layout'
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
})

describe('computeRegions', () => {
  it('wide planning は詳細欄を予約せず町を下端操作列まで広げる', () => {
    const r = computeRegions('wide', 1280, 720, NO_INSETS)
    expect(r.hud).toEqual({ x: 0, y: 0, width: 1280, height: 48 })
    expect(r.town.height).toBe(624)
    expect(r.strip.height).toBe(48)
    expect(r.tray.width).toBe(480)
    expect(r.strip.width).toBe(800)
    expect(r.detail).toBeNull()
    expect(r.hud.height + r.town.height + r.strip.height).toBe(720)
    expect(r.tray.x).toBe(r.strip.x + r.strip.width)
  })

  it('wide focus は詳細欄を確保し既存の操作密度を維持する', () => {
    const r = computeRegions('wide', 1280, 720, NO_INSETS, 'unit-focus')
    expect(r.town.height).toBe(460)
    expect(r.detail).toEqual({ x: 0, y: 556, width: 1280, height: 164 })
    expect(r.strip.y + r.strip.height).toBe(r.detail?.y)
    expect(r.hud.height + r.town.height + r.strip.height + (r.detail?.height ?? 0)).toBe(720)
  })

  it('narrow は通常時に詳細を持たず、focus時だけトレイ上へ重ねる', () => {
    const planning = computeRegions('narrow', 480, 854, NO_INSETS)
    expect(planning.hud.height).toBe(44)
    expect(planning.town.height).toBe(380)
    expect(planning.strip.height).toBe(48)
    expect(planning.strip.y + planning.strip.height).toBe(854)
    expect(planning.tray.y).toBe(planning.town.y + planning.town.height)
    expect(planning.detail).toBeNull()

    const focus = computeRegions('narrow', 480, 854, NO_INSETS, 'facility-focus')
    expect(focus.detail?.height).toBe(220)
    expect((focus.detail?.y ?? 0) + (focus.detail?.height ?? 0)).toBe(focus.strip.y)
    expect(focus.town).toEqual(planning.town)
    expect(focus.tray).toEqual(planning.tray)
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
    expect(notched.strip.y + notched.strip.height + 12).toBe(720)
    const focused = computeRegions(
      'wide',
      1280,
      720,
      { top: 20, right: 0, bottom: 12, left: 0 },
      'unit-focus',
    )
    expect((focused.detail?.y ?? 0) + (focused.detail?.height ?? 0) + 12).toBe(720)
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
