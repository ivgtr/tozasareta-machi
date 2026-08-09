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
})
