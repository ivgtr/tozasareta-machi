import { describe, expect, it } from 'vitest'
import {
  deriveTownManualViewport,
  deriveTownViewport,
  panTownViewport,
  townManualViewportFromTransform,
  transformTownViewportGesture,
} from '../src/scene/town/viewport'

describe('deriveTownViewport', () => {
  const wideTown = { x: 0, y: 56, width: 1280, height: 536 }
  const narrowTown = { x: 0, y: 52, width: 480, height: 620 }

  it('overview は固定FITより町を大きく表示する', () => {
    expect(deriveTownViewport(wideTown, 'wide', { mode: 'overview' }).scale).toBeGreaterThan(
      536 / 320,
    )
    expect(deriveTownViewport(narrowTown, 'narrow', { mode: 'overview' }).scale).toBeGreaterThan(1)
  })

  it('人物配置中はoverviewを維持して配置領域を潰さない', () => {
    const overview = deriveTownViewport(wideTown, 'wide', { mode: 'overview' })
    const unitFocus = deriveTownViewport(wideTown, 'wide', {
      mode: 'unit-focus',
      facility: 'road',
    })
    const unassigned = deriveTownViewport(narrowTown, 'narrow', {
      mode: 'unit-focus',
      facility: null,
    })

    expect(unitFocus).toEqual(overview)
    expect(unassigned).toEqual(deriveTownViewport(narrowTown, 'narrow', { mode: 'overview' }))
  })

  it('施設・再生focusは対象施設へ寄り、overview より拡大する', () => {
    const overview = deriveTownViewport(wideTown, 'wide', { mode: 'overview' })
    const facility = deriveTownViewport(wideTown, 'wide', {
      mode: 'facility-focus',
      facility: 'road',
    })
    const playback = deriveTownViewport(wideTown, 'wide', {
      mode: 'playback-target',
      facility: 'power',
    })

    expect(facility.scale).toBeGreaterThan(overview.scale)
    expect(facility.x).not.toBe(overview.x)
    expect(playback.x).not.toBe(facility.x)
  })

  it('手動viewの1倍は既存overviewと一致する', () => {
    expect(
      deriveTownManualViewport(wideTown, 'wide', { centerX: 300, centerY: 190, zoom: 1 }),
    ).toEqual(deriveTownViewport(wideTown, 'wide', { mode: 'overview' }))
  })

  it('カーソル位置を固定したまま拡大する', () => {
    const overview = deriveTownViewport(wideTown, 'wide', { mode: 'overview' })
    const anchor = { x: 640, y: 324 }
    const before = {
      x: (anchor.x - overview.x) / overview.scale,
      y: (anchor.y - overview.y) / overview.scale,
    }
    const zoomed = transformTownViewportGesture(
      wideTown,
      overview,
      anchor,
      anchor,
      1.5,
      overview.scale,
      overview.scale * 2,
    )
    const after = {
      x: (anchor.x - zoomed.x) / zoomed.scale,
      y: (anchor.y - zoomed.y) / zoomed.scale,
    }

    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
    expect(zoomed.scale).toBeCloseTo(overview.scale * 1.5)
  })

  it('最大倍率とpan範囲を町領域内へ制限する', () => {
    const overview = deriveTownViewport(wideTown, 'wide', { mode: 'overview' })
    const zoomed = transformTownViewportGesture(
      wideTown,
      overview,
      { x: 640, y: 324 },
      { x: 640, y: 324 },
      10,
      overview.scale,
      overview.scale * 2,
    )
    const panned = panTownViewport(wideTown, zoomed, 10_000, -10_000)

    expect(zoomed.scale).toBeCloseTo(overview.scale * 2)
    expect(panned.x).toBe(wideTown.x)
    expect(panned.y + 320 * panned.scale).toBeCloseTo(wideTown.y + wideTown.height)
  })

  it('町内中心座標を保持してwide/narrowで再計算できる', () => {
    const state = { centerX: 280, centerY: 160, zoom: 2 }
    const wide = deriveTownManualViewport(wideTown, 'wide', state)
    const narrow = deriveTownManualViewport(narrowTown, 'narrow', state)

    const wideState = townManualViewportFromTransform(wideTown, 'wide', wide)
    const narrowState = townManualViewportFromTransform(narrowTown, 'narrow', narrow)
    expect(wideState.centerX).toBeCloseTo(state.centerX)
    expect(wideState.centerY).toBeCloseTo(state.centerY)
    expect(wideState.zoom).toBeCloseTo(state.zoom)
    expect(narrowState.centerX).toBeCloseTo(state.centerX)
    expect(narrowState.centerY).toBeCloseTo(state.centerY)
    expect(narrowState.zoom).toBeCloseTo(state.zoom)
  })
})
