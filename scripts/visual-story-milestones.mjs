import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))
const BASELINE_PATH = path.join(PROJECT_ROOT, 'tests/visual-baselines/story-milestones.sig')
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'test-results/visual-story-milestones')
const PORT = Number(process.env.VISUAL_MILESTONE_PORT ?? 4185)
const BASE_URL = process.env.VISUAL_MILESTONE_BASE_URL ?? `http://127.0.0.1:${PORT}`
const APP_URL = `${BASE_URL.replace(/\/$/, '')}/?e2e=1&story=hold`
const BRIDGE = '__TOZASARETA_MACHI_E2E__'
const UPDATE = process.env.UPDATE_VISUAL_BASELINES === '1'
const GRID_WIDTH = 48
const GRID_HEIGHT = 48
const MAX_MEAN_DELTA = 3
const MAX_CHANGED_RATIO = 0.05
const CHANGED_DELTA = 16
const fixtures = ['act-stalemate', 'act-final', 'rescue-near']
const layouts = [
  { name: 'wide', viewport: { width: 1280, height: 720 } },
  { name: 'narrow', viewport: { width: 480, height: 854 } },
]
const failures = []
let server = null

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(BASE_URL)).ok) return
    } catch {}
    await delay(250)
  }
  throw new Error(`Vite server did not start: ${BASE_URL}`)
}

async function startServer() {
  if (process.env.VISUAL_MILESTONE_BASE_URL) return
  const vite = path.join(PROJECT_ROOT, 'node_modules/vite/bin/vite.js')
  server = spawn(
    process.execPath,
    [vite, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: PROJECT_ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  server.stdout?.on('data', (chunk) => process.stdout.write(chunk))
  server.stderr?.on('data', (chunk) => process.stderr.write(chunk))
  await waitForServer()
}

async function stopServer() {
  if (!server || server.exitCode !== null) return
  server.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    delay(2_000).then(() => server?.kill('SIGKILL')),
  ])
}

async function textBounds(page, text, exact = true) {
  const handle = await page.waitForFunction(
    ({ bridge, label, exactMatch }) => globalThis[bridge]?.textBounds(label, exactMatch) ?? false,
    { bridge: BRIDGE, label: text, exactMatch: exact },
  )
  return handle.jsonValue()
}

async function clickText(page, text, exact = true) {
  const bounds = await textBounds(page, text, exact)
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function waitForScene(page, key) {
  await page.waitForFunction(
    ({ bridge, scene }) => globalThis[bridge]?.snapshot().activeScenes.includes(scene),
    { bridge: BRIDGE, scene: key },
  )
}

async function enterPlayThroughPrologue(page) {
  await clickText(page, '▶ 指揮所へ')
  await waitForScene(page, 'Story')
  await page.keyboard.press('Enter')
  await textBounds(page, '救援まで', false)
  await page.keyboard.press('Enter')
  await textBounds(page, '指揮を引き継ぐ')
  await page.keyboard.press('Enter')
  await waitForScene(page, 'Play')
}

function grayscaleSignature(buffer) {
  const png = PNG.sync.read(buffer)
  const samples = Buffer.alloc(GRID_WIDTH * GRID_HEIGHT)
  for (let gy = 0; gy < GRID_HEIGHT; gy += 1) {
    const y0 = Math.floor((gy * png.height) / GRID_HEIGHT)
    const y1 = Math.floor(((gy + 1) * png.height) / GRID_HEIGHT)
    for (let gx = 0; gx < GRID_WIDTH; gx += 1) {
      const x0 = Math.floor((gx * png.width) / GRID_WIDTH)
      const x1 = Math.floor(((gx + 1) * png.width) / GRID_WIDTH)
      let sum = 0
      let count = 0
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const offset = (y * png.width + x) * 4
          const r = png.data[offset] ?? 0
          const g = png.data[offset + 1] ?? 0
          const b = png.data[offset + 2] ?? 0
          sum += (54 * r + 183 * g + 19 * b) >> 8
          count += 1
        }
      }
      samples[gy * GRID_WIDTH + gx] = count === 0 ? 0 : Math.round(sum / count)
    }
  }
  return { width: png.width, height: png.height, samples: samples.toString('base64') }
}

function compareSignature(name, actual, expected) {
  assert.equal(actual.width, expected.width, `${name}: screenshot width changed`)
  assert.equal(actual.height, expected.height, `${name}: screenshot height changed`)
  const actualSamples = Buffer.from(actual.samples, 'base64')
  const expectedSamples = Buffer.from(expected.samples, 'base64')
  assert.equal(actualSamples.length, expectedSamples.length, `${name}: signature size changed`)

  let totalDelta = 0
  let changed = 0
  for (let index = 0; index < actualSamples.length; index += 1) {
    const delta = Math.abs(actualSamples[index] - expectedSamples[index])
    totalDelta += delta
    if (delta >= CHANGED_DELTA) changed += 1
  }
  const meanDelta = totalDelta / actualSamples.length
  const changedRatio = changed / actualSamples.length
  if (meanDelta > MAX_MEAN_DELTA || changedRatio > MAX_CHANGED_RATIO) {
    failures.push(
      `${name}: mean delta ${meanDelta.toFixed(2)}, changed blocks ${(changedRatio * 100).toFixed(2)}%`,
    )
  }
}

await rm(OUTPUT_DIR, { recursive: true, force: true })
await mkdir(OUTPUT_DIR, { recursive: true })

let baselines = { version: 1, grid: { width: GRID_WIDTH, height: GRID_HEIGHT }, fixtures: {} }
if (!UPDATE) {
  const encoded = (await readFile(BASELINE_PATH, 'utf8')).trim()
  baselines = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'))
}
if (baselines.grid.width !== GRID_WIDTH || baselines.grid.height !== GRID_HEIGHT) {
  throw new Error('Story milestone visual baseline grid does not match the runner')
}

let browser
try {
  await startServer()
  browser = await chromium.launch({ headless: true })
  for (const layout of layouts) {
    const context = await browser.newContext({
      viewport: layout.viewport,
      locale: 'ja-JP',
      colorScheme: 'dark',
      reducedMotion: 'reduce',
      storageState: {
        cookies: [],
        origins: [
          {
            origin: new URL(BASE_URL).origin,
            localStorage: [
              {
                name: 'tozasareta-machi:settings',
                value: JSON.stringify({ animations: false, sound: false }),
              },
            ],
          },
        ],
      },
    })
    const page = await context.newPage()
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction((bridge) => Boolean(globalThis[bridge]), BRIDGE)
    await enterPlayThroughPrologue(page)

    for (const fixture of fixtures) {
      await page.evaluate(
        ({ bridge, fixtureName }) => globalThis[bridge].showFixture(fixtureName),
        { bridge: BRIDGE, fixtureName: fixture },
      )
      await page.waitForFunction(
        (bridge) => globalThis[bridge].snapshot().presentationMode === 'milestone',
        BRIDGE,
      )
      await page.evaluate(async () => {
        await document.fonts.ready
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })
      const name = `${fixture}-${layout.name}`
      const screenshot = await page.screenshot({ animations: 'disabled' })
      const signature = grayscaleSignature(screenshot)
      if (UPDATE) baselines.fixtures[name] = signature
      else {
        const expected = baselines.fixtures[name]
        if (!expected) failures.push(`Missing story milestone visual baseline: ${name}`)
        else compareSignature(name, signature, expected)
      }
      await writeFile(path.join(OUTPUT_DIR, `${name}-actual.png`), screenshot)
    }
    await context.close()
  }
} finally {
  await browser?.close()
  await stopServer()
}

if (UPDATE) {
  await mkdir(path.dirname(BASELINE_PATH), { recursive: true })
  const encoded = gzipSync(Buffer.from(`${JSON.stringify(baselines, null, 2)}\n`), {
    level: 9,
  }).toString('base64')
  await writeFile(BASELINE_PATH, `${encoded}\n`)
}
if (failures.length > 0) {
  throw new Error(`Story milestone visual regression failed:\n- ${failures.join('\n- ')}`)
}
process.stdout.write(
  UPDATE
    ? '\nStory milestone visual baselines updated.\n'
    : '\nStory milestone visual regression passed.\n',
)
