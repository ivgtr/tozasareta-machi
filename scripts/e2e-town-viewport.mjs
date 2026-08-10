import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))
const PORT = Number(process.env.E2E_TOWN_VIEWPORT_PORT ?? 4181)
const BASE_URL = process.env.E2E_TOWN_VIEWPORT_BASE_URL ?? `http://127.0.0.1:${PORT}`
const APP_URL = `${BASE_URL.replace(/\/$/, '')}/?e2e=1`
const BRIDGE = '__TOZASARETA_MACHI_E2E__'

let server = null
let browser = null

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(BASE_URL)
      if (response.ok) return
    } catch {
      // 起動待ち
    }
    await delay(250)
  }
  throw new Error(`Vite server did not start: ${BASE_URL}`)
}

async function startServer() {
  if (process.env.E2E_TOWN_VIEWPORT_BASE_URL) return
  const vite = path.join(PROJECT_ROOT, 'node_modules/vite/bin/vite.js')
  server = spawn(
    process.execPath,
    [vite, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
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

async function textBounds(page, text) {
  const handle = await page.waitForFunction(
    ({ bridge, label }) => globalThis[bridge]?.textBounds(label, true) ?? false,
    { bridge: BRIDGE, label: text },
  )
  return handle.jsonValue()
}

async function clickText(page, text) {
  const bounds = await textBounds(page, text)
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function facilityPoint(page, id) {
  const handle = await page.waitForFunction(
    ({ bridge, facility }) => globalThis[bridge]?.facilityArtPoint(facility) ?? false,
    { bridge: BRIDGE, facility: id },
  )
  return handle.jsonValue()
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

async function openPlanning(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'ja-JP',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    ...options,
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
    (bridge) => globalThis[bridge]?.snapshot().activeScenes.includes('Play'),
    BRIDGE,
  )
  await page.evaluate((bridge) => globalThis[bridge].showFixture('planning'), BRIDGE)
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().presentationMode === 'planning',
    BRIDGE,
  )
  return { context, page }
}

async function testMouseViewport() {
  const { context, page } = await openPlanning()
  try {
    const hqBefore = await facilityPoint(page, 'hq')
    const roadBefore = await facilityPoint(page, 'road')
    const distanceBefore = distance(hqBefore, roadBefore)

    await page.mouse.move(hqBefore.x, hqBefore.y)
    await page.mouse.wheel(0, -600)
    await delay(50)

    const hqZoomed = await facilityPoint(page, 'hq')
    const roadZoomed = await facilityPoint(page, 'road')
    assert.ok(
      distance(hqZoomed, roadZoomed) > distanceBefore * 1.25,
      'mouse wheel must enlarge the town around the pointer',
    )
    assert.ok(distance(hqBefore, hqZoomed) < 3, 'wheel anchor must stay under the pointer')

    await page.mouse.move(hqZoomed.x, hqZoomed.y)
    await page.mouse.down()
    await page.mouse.move(hqZoomed.x, hqZoomed.y + 80, { steps: 4 })
    await page.mouse.up()
    await delay(30)

    const roadPanned = await facilityPoint(page, 'road')
    assert.ok(roadPanned.y > roadZoomed.y + 30, 'dragging the enlarged town must pan it')
    assert.equal(
      await page.evaluate((bridge) => globalThis[bridge]?.snapshot().selectedFacility, BRIDGE),
      null,
      'panning from a facility must not be treated as a facility tap',
    )

    await page.mouse.click(roadPanned.x, roadPanned.y)
    await page.waitForFunction(
      (bridge) => globalThis[bridge]?.snapshot().selectedFacility === 'road',
      BRIDGE,
    )
  } finally {
    await context.close()
  }
}

async function testPinchViewport() {
  const { context, page } = await openPlanning({ hasTouch: true })
  try {
    const powerBefore = await facilityPoint(page, 'power')
    const roadBefore = await facilityPoint(page, 'road')
    const hq = await facilityPoint(page, 'hq')
    const distanceBefore = distance(powerBefore, roadBefore)
    const client = await context.newCDPSession(page)

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: hq.x - 30, y: hq.y, id: 1 },
        { x: hq.x + 30, y: hq.y, id: 2 },
      ],
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: hq.x - 75, y: hq.y, id: 1 },
        { x: hq.x + 75, y: hq.y, id: 2 },
      ],
    })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await delay(50)

    const powerZoomed = await facilityPoint(page, 'power')
    const roadZoomed = await facilityPoint(page, 'road')
    assert.ok(
      distance(powerZoomed, roadZoomed) > distanceBefore * 1.7,
      'two-finger pinch must enlarge the town',
    )
    const snapshot = await page.evaluate((bridge) => globalThis[bridge]?.snapshot(), BRIDGE)
    assert.equal(snapshot.selectedUnitId, null, 'pinch must not select or drag a unit')
    assert.equal(snapshot.selectedFacility, null, 'pinch must not tap a facility')

    await page.touchscreen.tap(roadZoomed.x, roadZoomed.y)
    await page.waitForFunction(
      (bridge) => globalThis[bridge]?.snapshot().selectedFacility === 'road',
      BRIDGE,
    )
  } finally {
    await context.close()
  }
}

try {
  await startServer()
  browser = await chromium.launch({ headless: true })
  await testMouseViewport()
  await testPinchViewport()
} finally {
  await browser?.close()
  await stopServer()
}

process.stdout.write('Town viewport E2E passed.\n')
