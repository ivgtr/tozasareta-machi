import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))
const PORT = Number(process.env.E2E_ENDING_LAYOUT_PORT ?? 4186)
const BASE_URL = process.env.E2E_ENDING_LAYOUT_BASE_URL ?? `http://127.0.0.1:${PORT}`
const APP_URL = `${BASE_URL.replace(/\/$/, '')}/?e2e=1`
const BRIDGE = '__TOZASARETA_MACHI_E2E__'
const MIN_GAP = 8
const layouts = [
  { name: 'wide', viewport: { width: 1280, height: 720 } },
  { name: 'narrow', viewport: { width: 600, height: 900 } },
]
let server = null

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function startServer() {
  if (process.env.E2E_ENDING_LAYOUT_BASE_URL) return
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
      if ((await fetch(BASE_URL)).ok) return
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

async function textBounds(page, text) {
  const handle = await page.waitForFunction(
    ({ bridge, label }) => globalThis[bridge]?.textBounds(label, true) ?? false,
    { bridge: BRIDGE, label: text },
  )
  return handle.jsonValue()
}

async function buttonBounds(page, label) {
  const handle = await page.waitForFunction(
    ({ bridge, text }) =>
      globalThis[bridge]?.buttonTargets().find((target) => target.label === text)?.hitBounds ?? false,
    { bridge: BRIDGE, text: label },
  )
  return handle.jsonValue()
}

async function clickText(page, text) {
  const bounds = await textBounds(page, text)
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

function bottom(bounds) {
  return bounds.y + bounds.height
}

function assertWithinViewport(bounds, viewport, label) {
  assert.ok(
    bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.x + bounds.width <= viewport.width &&
      bounds.y + bounds.height <= viewport.height,
    `${label} must stay inside viewport: ${JSON.stringify(bounds)}`,
  )
}

await startServer()
let browser
try {
  browser = await chromium.launch({ headless: true })
  for (const layout of layouts) {
    const context = await browser.newContext({
      viewport: layout.viewport,
      locale: 'ja-JP',
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
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction((bridge) => Boolean(globalThis[bridge]), BRIDGE)
    await clickText(page, '▶ 指揮所へ')
    await page.waitForFunction(
      (bridge) => globalThis[bridge]?.snapshot().activeScenes.includes('Play'),
      BRIDGE,
    )
    await page.evaluate((bridge) => globalThis[bridge].showFixture('ending'), BRIDGE)
    await page.waitForFunction(
      (bridge) => globalThis[bridge]?.snapshot().presentationMode === 'ending',
      BRIDGE,
    )

    const budgetValue = await textBounds(page, '48')
    const stockpileValue = await textBounds(page, '37')
    const titleButton = await buttonBounds(page, 'タイトルへ')
    const restartButton = await buttonBounds(page, 'もう一度')
    const recordBottom = Math.max(bottom(budgetValue), bottom(stockpileValue))
    const actionTop = Math.min(titleButton.y, restartButton.y)

    assert.ok(
      recordBottom + MIN_GAP <= actionTop,
      `${layout.name}: ending records overlap action row: recordsBottom=${recordBottom}, actionTop=${actionTop}`,
    )
    assertWithinViewport(titleButton, layout.viewport, `${layout.name}: title action`)
    assertWithinViewport(restartButton, layout.viewport, `${layout.name}: restart action`)
    assert.deepEqual(pageErrors, [], `${layout.name}: browser emitted an uncaught error`)
    await context.close()
  }
  process.stdout.write('Ending layout E2E passed.\n')
} finally {
  await browser?.close()
  await stopServer()
}
