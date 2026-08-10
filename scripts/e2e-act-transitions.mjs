import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))
const PORT = Number(process.env.E2E_ACT_PORT ?? 4184)
const BASE_URL = process.env.E2E_ACT_BASE_URL ?? `http://127.0.0.1:${PORT}`
const APP_URL = `${BASE_URL.replace(/\/$/, '')}/?e2e=1&story=hold`
const BRIDGE = '__TOZASARETA_MACHI_E2E__'
let server = null

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(BASE_URL)
      if (response.ok) return
    } catch {}
    await delay(250)
  }
  throw new Error(`Vite server did not start: ${BASE_URL}`)
}

async function startServer() {
  if (process.env.E2E_ACT_BASE_URL) return
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

async function waitForBridge(page) {
  await page.waitForFunction(
    (bridge) =>
      typeof globalThis[bridge]?.showActTransition === 'function' &&
      typeof globalThis[bridge]?.savePlanningDay === 'function',
    BRIDGE,
  )
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
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().presentationMode === 'planning',
    BRIDGE,
  )
}

async function assertVisibleText(page, text) {
  const found = await page.evaluate(
    ({ bridge, value }) => globalThis[bridge].textBounds(value, false) !== null,
    { bridge: BRIDGE, value: text },
  )
  assert.equal(found, true, `Expected visible text: ${text}`)
}

async function showAct(page, fromDay, expectedDay) {
  await page.evaluate(({ bridge, day }) => globalThis[bridge].showActTransition(day), {
    bridge: BRIDGE,
    day: fromDay,
  })
  await page.waitForFunction(
    ({ bridge, day }) => {
      const value = globalThis[bridge].snapshot()
      return value.day === day && value.presentationMode === 'milestone'
    },
    { bridge: BRIDGE, day: expectedDay },
  )
}

await startServer()
let browser
try {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
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
  await waitForBridge(page)
  await enterPlayThroughPrologue(page)

  await showAct(page, 10, 11)
  await assertVisibleText(page, 'ACT II / 膠着 / DAY 11')
  await assertVisibleText(page, '10 日経ちました')
  await assertVisibleText(page, 'ルール変更：電力劣化')
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    (bridge) => globalThis[bridge].snapshot().presentationMode === 'planning',
    BRIDGE,
  )

  await showAct(page, 20, 21)
  await assertVisibleText(page, 'ACT III / 正念場 / DAY 21')
  await assertVisibleText(page, '救援まで残り 10 日')
  await assertVisibleText(page, '医療消耗')
  await assertVisibleText(page, '収入')
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    (bridge) => globalThis[bridge].snapshot().presentationMode === 'planning',
    BRIDGE,
  )

  await page.evaluate((bridge) => globalThis[bridge].savePlanningDay(15), BRIDGE)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForBridge(page)
  const continueBounds = await textBounds(page, '▶ 続きから')
  await page.mouse.click(
    continueBounds.x + continueBounds.width / 2,
    continueBounds.y + continueBounds.height / 2,
  )
  await page.waitForFunction((bridge) => {
    const value = globalThis[bridge].snapshot()
    return (
      value.activeScenes.includes('Play') &&
      value.day === 15 &&
      value.presentationMode === 'planning'
    )
  }, BRIDGE)
  const rewound = await page.evaluate(
    (bridge) => globalThis[bridge].textBounds('ACT II / 膠着', false) !== null,
    BRIDGE,
  )
  assert.equal(rewound, false, 'Mid-Act resume must not replay a past milestone')
  assert.deepEqual(pageErrors, [], 'browser emitted an uncaught error')

  await context.close()
  process.stdout.write('Act transition E2E passed.\n')
} finally {
  await browser?.close()
  await stopServer()
}
