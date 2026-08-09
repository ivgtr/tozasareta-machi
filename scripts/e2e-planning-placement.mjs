import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))
const PORT = Number(process.env.PLACEMENT_E2E_PORT ?? 4174)
const BASE_URL = process.env.PLACEMENT_E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`
const APP_URL = `${BASE_URL.replace(/\/$/, '')}/?e2e=1`
const BRIDGE = '__TOZASARETA_MACHI_E2E__'
let server = null

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function startServer() {
  if (process.env.PLACEMENT_E2E_BASE_URL) return
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

async function bridgeCall(page, method, ...args) {
  return page.evaluate(
    ({ bridge, methodName, values }) => globalThis[bridge][methodName](...values),
    { bridge: BRIDGE, methodName: method, values: args },
  )
}

async function textBounds(page, text) {
  const handle = await page.waitForFunction(
    ({ bridge, value }) => globalThis[bridge]?.textBounds(value) ?? false,
    { bridge: BRIDGE, value: text },
  )
  return handle.jsonValue()
}

async function firstUnitBounds(page) {
  const handle = await page.waitForFunction(
    (bridge) => globalThis[bridge]?.firstUnitBounds() ?? false,
    BRIDGE,
  )
  return handle.jsonValue()
}

async function facilityPoint(page, id) {
  const handle = await page.waitForFunction(
    ({ bridge, facility }) => globalThis[bridge]?.facilityFootprintPoint(facility) ?? false,
    { bridge: BRIDGE, facility: id },
  )
  return handle.jsonValue()
}

async function clickBounds(page, bounds) {
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function clickPoint(page, point) {
  await page.mouse.click(point.x, point.y)
}

async function reset(page) {
  await bridgeCall(page, 'restartNewGame')
  await page.waitForFunction((bridge) => {
    const state = globalThis[bridge]?.snapshot()
    return state?.presentationMode === 'planning' && state.plannedAssignments === 0
  }, BRIDGE)
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
  page.on('pageerror', (error) => pageErrors.push(error))
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction((bridge) => Boolean(globalThis[bridge]), BRIDGE)
  await clickBounds(page, await textBounds(page, '▶ 指揮所へ'))
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().activeScenes.includes('Play'),
    BRIDGE,
  )

  process.stdout.write('• 人物選択時も町のoverviewを維持する\n')
  const roadBefore = await facilityPoint(page, 'road')
  await clickBounds(page, await firstUnitBounds(page))
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().presentationMode === 'unit-focus',
    BRIDGE,
  )
  const roadAfter = await facilityPoint(page, 'road')
  assert.ok(Math.abs(roadAfter.x - roadBefore.x) <= 1, 'unit selection moved town horizontally')
  assert.ok(Math.abs(roadAfter.y - roadBefore.y) <= 1, 'unit selection moved town vertically')
  const hq = await facilityPoint(page, 'hq')
  await page.mouse.move(hq.x, hq.y)
  await textBounds(page, '本部')
  await textBounds(page, '配置不可')
  assert.equal(await bridgeCall(page, 'textBounds', '発電設備'), null)
  await page.mouse.move(roadAfter.x, roadAfter.y)
  await textBounds(page, '配置可能')
  await clickPoint(page, roadAfter)
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().plannedAssignments === 1,
    BRIDGE,
  )

  process.stdout.write('• 施設から人物を選んで配置できる\n')
  await reset(page)
  await clickPoint(page, await facilityPoint(page, 'road'))
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().selectedFacility === 'road',
    BRIDGE,
  )
  await clickBounds(page, await textBounds(page, 'Deckから\n配置'))
  await textBounds(page, '人物を\n選択')
  await clickBounds(page, await firstUnitBounds(page))
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().plannedAssignments === 1,
    BRIDGE,
  )

  process.stdout.write('• FacilityFocusの空きslotへDnDできる\n')
  await reset(page)
  await clickPoint(page, await facilityPoint(page, 'road'))
  const source = await firstUnitBounds(page)
  const drop = await textBounds(page, 'Deckから\n配置')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(drop.x + drop.width / 2, drop.y + drop.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().plannedAssignments === 1,
    BRIDGE,
  )

  process.stdout.write('• タイトルから最初からを選ぶと未確定配置を破棄する\n')
  await page.keyboard.press('KeyM')
  await clickBounds(page, await textBounds(page, 'タイトルに戻る'))
  await page.waitForFunction(
    (bridge) => globalThis[bridge]?.snapshot().activeScenes.includes('Title'),
    BRIDGE,
  )
  await clickBounds(page, await textBounds(page, '最初から'))
  await page.waitForFunction((bridge) => {
    const state = globalThis[bridge]?.snapshot()
    return (
      state?.activeScenes.includes('Play') &&
      state.day === 1 &&
      state.phase === 'planning' &&
      state.historyLength === 0 &&
      state.plannedAssignments === 0
    )
  }, BRIDGE)

  assert.deepEqual(
    pageErrors.map((error) => error.message),
    [],
    'browser emitted an uncaught error',
  )
  await context.close()
  process.stdout.write('\nPlanning placement E2E passed.\n')
} finally {
  await browser?.close()
  await stopServer()
}
