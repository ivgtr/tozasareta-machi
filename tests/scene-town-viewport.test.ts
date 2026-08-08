import { describe, expect, it } from 'vitest'
import { deriveTownViewport } from '../src/scene/town/viewport'

describe('deriveTownViewport', () => {
  const wideTown = { x: 0, y: 56, width: 1280, height: 536 }
  const narrowTown = { x: 0, y: 52, width: 480, height: 620 }

  it('overview は固定FITより町を大きく表示する', () => {
    expect(deriveTownViewport(wideTown, 'wide', { mode: 'overview' }).scale).toBeGreaterThan(
      536 / 320,
    )
    expect(deriveTownViewport(narrowTown, 'narrow', { mode: 'overview' }).scale).toBeGreaterThan(1)
  })

  it('focus presets は対象施設へ寄り、overview より拡大する', () => {
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

  it('未配置の unit focus は本部を対象にする', () => {
    expect(
      deriveTownViewport(narrowTown, 'narrow', { mode: 'unit-focus', facility: null }),
    ).toEqual(deriveTownViewport(narrowTown, 'narrow', { mode: 'unit-focus', facility: 'hq' }))
  })
})
