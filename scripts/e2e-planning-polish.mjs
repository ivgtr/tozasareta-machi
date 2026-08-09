import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'test-results/e2e-planning-polish')
const PORT = Number(process.env.E2E_POLISH_PORT ?? 4177)
const BASE_URL = process.env.E2E_POLISH_BASE_URL ?? `http://127.0.0.1:${PORT}`
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
  if (process.env.E2E_POLISH_BASE_URL) return
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

async function textBounds(page, text, exact = true) {
  const handle = await page.waitForFunction(
    ({ bridge, label, exactMatch }) => globalThis[bridge]?.textBounds(label, exactMatch) ?? false,
    { bridge: BRIDGE, label: text, exactMatch: exact },
  )
  return handle.jsonValue()
}

async function buttonTarget(page, label) {
  const handle = await page.waitForFunction(
    ({ bridge, text }) =>
      globalThis[bridge]?.buttonTargets().find((target) => target.label === text) ?? false,
    { bridge: BRIDGE, text: label },
  )
  return handle.jsonValue()
}

async function clickText(page, text, exact = true) {
  const bounds = await textBounds(page, text, exact)
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

function centerY(bounds) {
  return bounds.y + bounds.height / 2
}

function right(bounds) {
  return bounds.x + bounds.width
}

function assertAlignedRow(targets, message) {
  const [first, ...rest] = targets
  assert.ok(first, `${message}: no targets`)
  for (const target of rest) {
    assert.ok(Math.abs(centerY(target.hitBounds) - centerY(first.hitBounds)) <= 1, message)
    assert.equal(target.hitBounds.height, first.hitBounds.height, message)
  }
}

function assertEvenHorizontalGaps(targets) {
  const gaps = targets.slice(1).map((target, index) => target.hitBounds.x - right(targets[index].hitBounds))
  const [firstGap, ...rest] = gaps
  assert.ok(firstGap > 0, `planning controls gap must be positive: ${JSON.stringify(gaps)}`)
  for (const gap of rest) {
    assert.ok(
      Math.abs(gap - firstGap) <= 1,
      `planning controls gaps must match: ${JSON.stringify(gaps)}`,
    )
  }
}

async function assertPlanningControls(page) {
  const ration = await buttonTarget(page, '配給 通常')
  const procure = await buttonTarget(page, '調達 OFF')
  const context = await buttonTarget(page, '自動配置')
  const commit = await buttonTarget(page, '今日を終える ▶')
  const targets = [ration, procure, context, commit]
  assert.ok(
    Math.abs(ration.hitBounds.width - procure.hitBounds.width) <= 0.01,
    'secondary button width mismatch',
  )
  assert.ok(
    Math.abs(ration.hitBounds.width - context.hitBounds.width) <= 0.01,
    'secondary button width mismatch',
  )
  assertAlignedRow(targets, 'planning controls must share one row')
  assertEvenHorizontalGaps(targets)

  const canvas = await page.locator('canvas').first().boundingBox()
  assert.ok(canvas, 'game canvas bounds must be available')
  assert.ok(
    right(commit.hitBounds) <= canvas.x + canvas.width + 1,
    `commit button overflows canvas: ${JSON.stringify({ commit: commit.hitBounds, canvas })}`,
  )

  const forecast = await textBounds(page, '本日の見込', false)
  assert.ok(
    forecast.y + forecast.height < ration.hitBounds.y,
    `forecast overlaps controls: ${JSON.stringify({ forecast, button: ration.hitBounds })}`,
  )
}

await rm(OUTPUT_DIR, { recursive: true, force: true })
await mkdir(OUTPUT_DIR, { recursive: true })

try {
  await startServer()
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
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
    (bridge) => globalThis[bridge]?.snapshot().activeScenes.includes('Play'),
    BRIDGE,
  )

  await page.evaluate((bridge) => globalThis[bridge].showFixture('planning'), BRIDGE)
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().presentationMode === 'planning',
    BRIDGE,
  )
  await assertPlanningControls(page)

  await page.evaluate((bridge) => globalThis[bridge].showFixture('planning-assigned'), BRIDGE)
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().presentationMode === 'planning',
    BRIDGE,
  )
  const assignedContext = await buttonTarget(page, '自動配置')
  assert.ok(assignedContext, 'auto placement should remain available without a selected unit')
  const assignedForecast = await textBounds(page, '本日の見込', false)
  const assignedRation = await buttonTarget(page, '配給 通常')
  assert.ok(
    assignedForecast.y + assignedForecast.height < assignedRation.hitBounds.y,
    'two-row forecast must stay above the action row',
  )

  await page.evaluate((bridge) => globalThis[bridge].showFixture('planning'), BRIDGE)
  const firstUnit = await page.waitForFunction(
    (bridge) => globalThis[bridge]?.firstUnitBounds() ?? false,
    BRIDGE,
  )
  const firstUnitBounds = await firstUnit.jsonValue()
  await page.mouse.click(
    firstUnitBounds.x + firstUnitBounds.width / 2,
    firstUnitBounds.y + firstUnitBounds.height / 2,
  )
  await clickText(page, '詳細')
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().characterInspectorOpen,
    BRIDGE,
  )
  await textBounds(page, '二期目の町長')

  await clickText(page, '榊直人')
  await page.waitForFunction(
    (bridge) =>
      globalThis[bridge]?.snapshot().characterInspectorOpen &&
      globalThis[bridge]?.snapshot().selectedUnitId === 'medic',
    BRIDGE,
  )
  await textBounds(page, '町の診療所医')
  assert.equal(
    await page.evaluate((bridge) => globalThis[bridge]?.snapshot().placementStatusOpen, BRIDGE),
    false,
    'placement status must stay hidden while the inspector is open',
  )

  await clickText(page, '閉じる')
  await page.waitForFunction(
    (bridge) =>
      !globalThis[bridge]?.snapshot().characterInspectorOpen &&
      globalThis[bridge]?.snapshot().placementStatusOpen &&
      globalThis[bridge]?.snapshot().selectedUnitId === 'medic',
    BRIDGE,
  )

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'planning-polish.png') })
  await context.close()
} finally {
  await browser?.close()
  await stopServer()
}

process.stdout.write('Planning polish E2E passed.\n')
