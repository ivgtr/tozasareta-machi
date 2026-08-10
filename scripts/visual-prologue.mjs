import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import pixelmatch from 'pixelmatch'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))
const BASELINE_DIR = path.join(PROJECT_ROOT, 'tests/visual-baselines')
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'test-results/visual')
const PORT = Number(process.env.PROLOGUE_VISUAL_PORT ?? 4179)
const BASE_URL = process.env.PROLOGUE_VISUAL_BASE_URL ?? `http://127.0.0.1:${PORT}`
const APP_URL = `${BASE_URL.replace(/\/$/, '')}/?e2e=1&story=hold`
const BRIDGE = '__TOZASARETA_MACHI_E2E__'
const UPDATE = process.env.UPDATE_VISUAL_BASELINES === '1'
const PIXEL_COLOR_THRESHOLD = 0.5
const MAX_DIFF_RATIO = 0.003
const BOOTSTRAP_MISSING = process.env.PROLOGUE_VISUAL_REQUIRE_BASELINE !== '1'
const layouts = [
  { name: 'wide', viewport: { width: 1280, height: 720 } },
  { name: 'narrow', viewport: { width: 480, height: 854 } },
]
const failures = []
let server = null

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function startServer() {
  if (process.env.PROLOGUE_VISUAL_BASE_URL) return
  const vite = path.join(PROJECT_ROOT, 'node_modules/vite/bin/vite.js')
  server = spawn(
    process.execPath,
    [vite, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: PROJECT_ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  server.stdout?.on('data', (chunk) => process.stdout.write(chunk))
  server.stderr?.on('data', (chunk) => process.stderr.write(chunk))
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(BASE_URL)
      if (response.ok) return
    } catch {}
    await delay(250)
  }
  throw new Error(`Vite server did not start: ${BASE_URL}`)
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

async function clickText(page, text) {
  const bounds = await textBounds(page, text)
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

async function compare(name, actualBuffer) {
  const baselinePath = path.join(BASELINE_DIR, `${name}.png`)
  const actualPath = path.join(OUTPUT_DIR, `${name}-actual.png`)
  await writeFile(actualPath, actualBuffer)

  if (UPDATE) {
    await writeFile(baselinePath, actualBuffer)
    process.stdout.write(`  updated ${name}\n`)
    return
  }

  let baselineBuffer
  try {
    baselineBuffer = await readFile(baselinePath)
  } catch {
    if (BOOTSTRAP_MISSING) {
      process.stdout.write(`  captured ${name} (baseline bootstrap)\n`)
      return
    }
    failures.push(`Missing baseline ${name}. Run npm run test:visual:update.`)
    return
  }

  const baseline = PNG.sync.read(baselineBuffer)
  const actual = PNG.sync.read(actualBuffer)
  try {
    assert.equal(actual.width, baseline.width, `${name}: screenshot width changed`)
    assert.equal(actual.height, baseline.height, `${name}: screenshot height changed`)
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
    return
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height })
  const changed = pixelmatch(
    baseline.data,
    actual.data,
    diff.data,
    baseline.width,
    baseline.height,
    { threshold: PIXEL_COLOR_THRESHOLD, includeAA: false },
  )
  const ratio = changed / (baseline.width * baseline.height)
  if (ratio > MAX_DIFF_RATIO) {
    await writeFile(path.join(OUTPUT_DIR, `${name}-diff.png`), PNG.sync.write(diff))
    failures.push(`${name}: ${(ratio * 100).toFixed(3)}% of pixels changed`)
    return
  }
  process.stdout.write(`  matched ${name} (${changed} pixels)\n`)
}

await mkdir(OUTPUT_DIR, { recursive: true })
await mkdir(BASELINE_DIR, { recursive: true })

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
    await clickText(page, '▶ 指揮所へ')
    await page.waitForFunction(
      (bridge) => globalThis[bridge]?.snapshot().activeScenes.includes('Story'),
      BRIDGE,
    )
    await page.keyboard.press('Enter')
    await textBounds(page, '救援まで', false)
    await settle(page)
    await compare(`prologue-${layout.name}`, await page.screenshot({ animations: 'disabled' }))
    await context.close()
  }
} finally {
  await browser?.close()
  await stopServer()
}

if (failures.length > 0) {
  throw new Error(`Prologue visual regression failed:\n- ${failures.join('\n- ')}`)
}
process.stdout.write('\nPrologue visual regression passed.\n')
