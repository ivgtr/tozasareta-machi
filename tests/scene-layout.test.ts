import { describe, expect, it } from 'vitest'
import { NO_INSETS, deviceClassOf, designSizeOf } from '../src/scene/layout'
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

describe('computeRegions', () => {
  it('wide は §4.5 の寸法どおりに積み上がる', () => {
    const r = computeRegions('wide', 1280, 720, NO_INSETS)
    expect(r.hud).toEqual({ x: 0, y: 0, width: 1280, height: 48 })
    expect(r.town.height).toBe(460)
    expect(r.strip.height).toBe(48)
    expect(r.tray.width).toBe(440)
    expect(r.strip.width).toBe(840)
    expect(r.detail.height).toBe(164)
    expect(r.hud.height + r.town.height + r.strip.height + r.detail.height).toBe(720)
    expect(r.strip.y + r.strip.height).toBe(r.detail.y)
    expect(r.tray.x).toBe(r.strip.x + r.strip.width)
  })

  it('narrow は HUD44 / 町380 / ストリップ48 で町が上部に支配的', () => {
    const r = computeRegions('narrow', 480, 854, NO_INSETS)
    expect(r.hud.height).toBe(44)
    expect(r.town.height).toBe(380)
    expect(r.strip.height).toBe(48)
    expect(r.strip.y + r.strip.height).toBe(854)
    expect(r.tray.y).toBe(r.town.y + r.town.height)
    expect(r.detail.height).toBe(220)
    expect(r.detail.y + r.detail.height).toBe(r.strip.y)
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
    expect(notched.detail.y + notched.detail.height + 12).toBe(720)
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
