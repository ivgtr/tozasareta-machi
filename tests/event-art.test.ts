import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { EVENTS } from '../src/game/data/events-data'
import { ART_SPECS } from '../src/scene/art/manifest'

const EVENT_ASSET_DIR = fileURLToPath(new URL('../src/assets/event/', import.meta.url))
const EVENT_PRESENTATION_IDS = EVENTS.filter((event) => event.id !== 'arrival').map(
  (event) => event.id,
)
const EVENT_ASSET_IDS = [...EVENT_PRESENTATION_IDS, 'rescue_contact'].sort()

describe('event art contract', () => {
  it('通常プレイで表示する全Eventに固有画像を持つ', () => {
    const actual = readdirSync(EVENT_ASSET_DIR)
      .filter((name) => name.endsWith('.png'))
      .map((name) => name.replace(/\.png$/, ''))
      .sort()
    const manifest = ART_SPECS.filter((spec) => spec.kind === 'event').map((spec) => spec.id)

    expect(actual).toEqual(EVENT_ASSET_IDS)
    expect(manifest).toEqual(expect.arrayContaining(EVENT_PRESENTATION_IDS))
  })

  it('全Event画像を128x80の不透明32色以下に統一する', () => {
    for (const id of EVENT_ASSET_IDS) {
      const png = PNG.sync.read(readFileSync(`${EVENT_ASSET_DIR}${id}.png`))
      const colors = new Set<string>()
      let transparentPixels = 0

      for (let index = 0; index < png.data.length; index += 4) {
        colors.add(`${png.data[index]},${png.data[index + 1]},${png.data[index + 2]}`)
        if (png.data[index + 3] !== 255) transparentPixels += 1
      }

      expect({ id, width: png.width, height: png.height }).toEqual({
        id,
        width: 128,
        height: 80,
      })
      expect({ id, transparentPixels }).toEqual({ id, transparentPixels: 0 })
      expect(colors.size, id).toBeLessThanOrEqual(32)
    }
  })
})
