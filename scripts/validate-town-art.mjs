import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const ASSET_ROOT = fileURLToPath(new URL('../src/assets/', import.meta.url))

const WORLD_PALETTE = new Set([
  '#000000',
  '#080b1a',
  '#0a0e24',
  '#0f1330',
  '#131740',
  '#171c49',
  '#1c2258',
  '#252c67',
  '#343a57',
  '#596078',
  '#81889c',
  '#b1b7c9',
  '#e8ecff',
  '#25445a',
  '#3f6880',
  '#2b211f',
  '#49332a',
  '#5c3f32',
  '#6b4a34',
  '#8a6848',
  '#182d2b',
  '#27443a',
  '#3f6652',
  '#b57932',
  '#e39b3d',
  '#ffc857',
  '#ffd94a',
  '#ff5f66',
  '#5ee6a8',
  '#6fd8ff',
])

const CONTRACT = [
  { path: 'town/base.png', width: 480, height: 320, background: 'opaque' },
  {
    path: 'facility/hq-normal.png',
    width: 96,
    height: 112,
    background: 'transparent',
  },
  {
    path: 'facility/power-normal.png',
    width: 96,
    height: 112,
    background: 'transparent',
  },
  {
    path: 'facility/power-low.png',
    width: 96,
    height: 112,
    background: 'transparent',
  },
  {
    path: 'facility/power-working.png',
    width: 96,
    height: 112,
    background: 'transparent',
  },
  {
    path: 'facility/road-collapsed.png',
    width: 96,
    height: 112,
    background: 'transparent',
  },
  {
    path: 'facility/road-working.png',
    width: 96,
    height: 112,
    background: 'transparent',
  },
  {
    path: 'facility/clinic-normal.png',
    width: 96,
    height: 112,
    background: 'transparent',
  },
  {
    path: 'facility/clinic-working.png',
    width: 96,
    height: 112,
    background: 'transparent',
  },
  {
    path: 'facility/plaza-normal.png',
    width: 96,
    height: 112,
    background: 'transparent',
  },
  {
    path: 'facility/plaza-working.png',
    width: 96,
    height: 112,
    background: 'transparent',
  },
  {
    path: 'facility/warehouse-normal.png',
    width: 96,
    height: 112,
    background: 'transparent',
  },
  { path: 'token/person_male_a.png', width: 24, height: 32, background: 'transparent' },
  { path: 'token/person_male_b.png', width: 24, height: 32, background: 'transparent' },
  { path: 'token/person_female_a.png', width: 24, height: 32, background: 'transparent' },
  { path: 'token/person_female_b.png', width: 24, height: 32, background: 'transparent' },
]

function listPngs(kind) {
  return readdirSync(`${ASSET_ROOT}${kind}`, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
    .map((entry) => `${kind}/${entry.name}`)
}

function hex(r, g, b) {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`
}

function inspectAsset(spec) {
  const png = PNG.sync.read(readFileSync(`${ASSET_ROOT}${spec.path}`))
  const colors = new Set()
  let transparentPixels = 0
  let partialAlphaPixels = 0

  for (let index = 0; index < png.data.length; index += 4) {
    const alpha = png.data[index + 3]
    if (alpha === 0) {
      transparentPixels += 1
      continue
    }
    if (alpha !== 255) partialAlphaPixels += 1

    const color = hex(png.data[index], png.data[index + 1], png.data[index + 2])
    colors.add(color)
  }

  return { png, colors, transparentPixels, partialAlphaPixels }
}

function alphaDifference(firstPath, secondPath) {
  const first = PNG.sync.read(readFileSync(`${ASSET_ROOT}${firstPath}`))
  const second = PNG.sync.read(readFileSync(`${ASSET_ROOT}${secondPath}`))
  let changed = 0

  for (let index = 3; index < first.data.length; index += 4) {
    if (first.data[index] !== second.data[index]) changed += 1
  }

  return changed
}

const expected = CONTRACT.map((asset) => asset.path).sort()
const actual = ['town', 'facility', 'token'].flatMap(listPngs).sort()
const errors = []

if (expected.length !== 16) {
  errors.push(`contract must define exactly 16 assets, got ${expected.length}`)
}

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  const missing = expected.filter((path) => !actual.includes(path))
  const extra = actual.filter((path) => !expected.includes(path))
  if (missing.length > 0) errors.push(`missing assets: ${missing.join(', ')}`)
  if (extra.length > 0) errors.push(`unexpected assets: ${extra.join(', ')}`)
}

for (const spec of CONTRACT) {
  const { png, colors, transparentPixels, partialAlphaPixels } = inspectAsset(spec)

  if (png.width !== spec.width || png.height !== spec.height) {
    errors.push(
      `${spec.path}: expected ${spec.width}x${spec.height}, got ${png.width}x${png.height}`,
    )
  }

  if (spec.background === 'opaque' && transparentPixels !== 0) {
    errors.push(`${spec.path}: town base must be fully opaque`)
  }
  if (spec.background === 'transparent' && transparentPixels === 0) {
    errors.push(`${spec.path}: sprite must contain transparent background pixels`)
  }
  if (partialAlphaPixels !== 0) {
    errors.push(`${spec.path}: contains ${partialAlphaPixels} partially transparent pixels`)
  }

  const invalidColors = [...colors].filter((color) => !WORLD_PALETTE.has(color))
  if (invalidColors.length > 0) {
    errors.push(`${spec.path}: colors outside world palette: ${invalidColors.join(', ')}`)
  }
  if (colors.size > 32) {
    errors.push(`${spec.path}: uses ${colors.size} opaque colors; maximum is 32`)
  }
}

const powerStateAlphaDifference = alphaDifference(
  'facility/power-normal.png',
  'facility/power-low.png',
)
if (powerStateAlphaDifference !== 0) {
  errors.push(`power normal/low alpha masks differ at ${powerStateAlphaDifference} pixels`)
}

if (errors.length > 0) {
  throw new Error(`Town art contract failed:\n- ${errors.join('\n- ')}`)
}

console.log(`Town art contract OK: ${CONTRACT.length} assets, ${WORLD_PALETTE.size}-color palette`)
