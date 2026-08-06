import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, rm, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'test-results/e2e')
const PORT = Number(process.env.E2E_PORT ?? 4173)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`
const APP_URL = `${BASE_URL.replace(/\/$/, '')}/?e2e=1`
const BRIDGE = '__TOZASARETA_MACHI_E2E__'

let server = null
let browser = null
const failures = []

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
  if (process.env.E2E_BASE_URL) return
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
  server.once('exit', (code) => {
    if (code && code !== 0) process.stderr.write(`Vite exited with code ${code}\n`)
  })
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

async function openGame({
  viewport = { width: 1280, height: 720 },
  deviceScaleFactor = 1,
  animations = false,
} = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    locale: 'ja-JP',
    colorScheme: 'dark',
    reducedMotion: animations ? 'no-preference' : 'reduce',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(BASE_URL).origin,
          localStorage: [
            {
              name: 'tozasareta-machi:settings',
              value: JSON.stringify({ animations }),
            },
          ],
        },
      ],
    },
  })
  await context.addInitScript(() => {
    Object.defineProperty(globalThis, 'confirm', {
      configurable: true,
      value: () => true,
    })
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error))
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction((name) => Boolean(globalThis[name]), BRIDGE)
  return { context, page, pageErrors }
}

async function snapshot(page) {
  return page.evaluate((name) => globalThis[name].snapshot(), BRIDGE)
}

async function textBounds(page, text, exact = true) {
  const handle = await page.waitForFunction(
    ({ name, label, exactMatch }) => globalThis[name]?.textBounds(label, exactMatch) ?? false,
    { name: BRIDGE, label: text, exactMatch: exact },
  )
  return handle.jsonValue()
}

async function optionalTextBounds(page, text, exact = true) {
  return page.evaluate(
    ({ name, label, exactMatch }) => globalThis[name]?.textBounds(label, exactMatch) ?? null,
    { name: BRIDGE, label: text, exactMatch: exact },
  )
}

async function clickText(page, text, exact = true) {
  const bounds = await textBounds(page, text, exact)
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function clickFirstUnit(page) {
  const handle = await page.waitForFunction(
    (name) => globalThis[name]?.firstUnitBounds() ?? false,
    BRIDGE,
  )
  const bounds = await handle.jsonValue()
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function startNewGame(page) {
  await clickText(page, '▶ 指揮所へ')
  await page.waitForFunction(
    (name) => globalThis[name]?.snapshot().activeScenes.includes('Play'),
    BRIDGE,
  )
}

async function commitWithAutoAssign(page) {
  const wideAuto = await optionalTextBounds(page, 'おまかせ')
  await clickText(page, wideAuto ? 'おまかせ' : '自動')
  const wideCommit = await optionalTextBounds(page, '本日の対応を確定')
  await clickText(page, wideCommit ? '本日の対応を確定' : '確定')
  const confirm = await optionalTextBounds(page, 'このまま開始')
  if (confirm) {
    await page.mouse.click(confirm.x + confirm.width / 2, confirm.y + confirm.height / 2)
  }
}

async function capture(page, name) {
  const target = path.join(OUTPUT_DIR, `${name}.png`)
  await page.screenshot({ path: target, fullPage: true })
  const info = await stat(target)
  assert.ok(info.size > 10_000, `${name}: screenshot is unexpectedly small`)
}

function assertNoPageErrors(pageErrors) {
  assert.deepEqual(
    pageErrors.map((error) => error.message),
    [],
    'browser emitted an uncaught error',
  )
}

async function withGame(name, options, run) {
  const opened = await openGame(options)
  try {
    await run(opened.page)
    assertNoPageErrors(opened.pageErrors)
  } catch (error) {
    await capture(opened.page, `failure-${name}`).catch(() => {})
    throw error
  } finally {
    await opened.context.close()
  }
}

async function test(name, run) {
  process.stdout.write(`• ${name}\n`)
  try {
    await run()
    process.stdout.write(`  ✓ passed\n`)
  } catch (error) {
    failures.push({ name, error })
    process.stderr.write(`  ✗ ${error.stack ?? error}\n`)
  }
}

await rm(OUTPUT_DIR, { recursive: true, force: true })
await mkdir(OUTPUT_DIR, { recursive: true })

try {
  await startServer()
  browser = await chromium.launch({ headless: true })

  await test('ユニット詳細を閉じた後に再表示できる', async () => {
    await withGame('unit-details', {}, async (page) => {
      await startNewGame(page)
      await clickFirstUnit(page)
      await clickText(page, '詳細')
      await page.waitForFunction((name) => globalThis[name]?.snapshot().unitDetailsOpen, BRIDGE)
      await capture(page, 'unit-details-first-open')

      await clickText(page, '閉じる')
      await page.waitForFunction((name) => !globalThis[name]?.snapshot().unitDetailsOpen, BRIDGE)
      await clickText(page, '詳細')
      await page.waitForFunction((name) => globalThis[name]?.snapshot().unitDetailsOpen, BRIDGE)
      await capture(page, 'unit-details-second-open')
    })
  })

  await test('演出中の新規ゲームで旧再生状態を残さない', async () => {
    await withGame('restart-playback', { animations: true }, async (page) => {
      await startNewGame(page)
      await commitWithAutoAssign(page)
      await page.waitForFunction((name) => globalThis[name]?.snapshot().busy, BRIDGE)
      await clickText(page, 'メニュー')
      await page.waitForFunction((name) => globalThis[name]?.snapshot().menuOpen, BRIDGE)
      await clickText(page, '最初から')
      await page.waitForFunction(
        (name) => {
          const value = globalThis[name]?.snapshot()
          return value && value.day === 1 && value.phase === 'planning' && !value.busy
        },
        BRIDGE,
      )
      const state = await snapshot(page)
      assert.equal(state.historyLength, 0)
      await capture(page, 'restart-during-playback')
    })
  })

  await test('確定した進行をリロード後に再開できる', async () => {
    await withGame('reload-save', {}, async (page) => {
      await startNewGame(page)
      await commitWithAutoAssign(page)
      await page.waitForFunction(
        (name) => {
          const value = globalThis[name]?.snapshot()
          return value && value.day >= 2 && !value.busy
        },
        BRIDGE,
      )
      const before = await snapshot(page)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForFunction((name) => Boolean(globalThis[name]), BRIDGE)
      await clickText(page, '▶ 続きから')
      await page.waitForFunction(
        ({ name, day }) => {
          const value = globalThis[name]?.snapshot()
          return value && value.activeScenes.includes('Play') && value.day === day
        },
        { name: BRIDGE, day: before.day },
      )
      await capture(page, 'resume-after-reload')
    })
  })

  await test('wide/narrowとDPR 1/2で論理寸法を維持する', async () => {
    const dpr1 = await openGame({ deviceScaleFactor: 1 })
    const dpr2 = await openGame({ deviceScaleFactor: 2 })
    try {
      await startNewGame(dpr1.page)
      await startNewGame(dpr2.page)
      const wide1 = await snapshot(dpr1.page)
      const wide2 = await snapshot(dpr2.page)
      const menu1 = await textBounds(dpr1.page, 'メニュー')
      const menu2 = await textBounds(dpr2.page, 'メニュー')

      assert.deepEqual(wide1.gameSize, { width: 1280, height: 720 })
      assert.deepEqual(wide2.gameSize, { width: 1280, height: 720 })
      assert.equal(wide2.canvas.width, wide1.canvas.width)
      assert.ok(Math.abs(menu1.height - menu2.height) <= 1)
      await capture(dpr1.page, 'wide-dpr1')
      await capture(dpr2.page, 'wide-dpr2')

      await Promise.all([
        dpr1.page.setViewportSize({ width: 600, height: 900 }),
        dpr2.page.setViewportSize({ width: 600, height: 900 }),
      ])
      await Promise.all(
        [dpr1.page, dpr2.page].map((page) =>
          page.waitForFunction(
            (name) => {
              const value = globalThis[name]?.snapshot()
              return value && value.deviceClass === 'narrow' && value.gameSize.width === 480
            },
            BRIDGE,
          ),
        ),
      )
      const narrow1 = await snapshot(dpr1.page)
      const narrow2 = await snapshot(dpr2.page)
      const narrowMenu1 = await textBounds(dpr1.page, 'メニュ')
      const narrowMenu2 = await textBounds(dpr2.page, 'メニュ')

      assert.deepEqual(narrow1.gameSize, { width: 480, height: 854 })
      assert.deepEqual(narrow2.gameSize, { width: 480, height: 854 })
      assert.equal(await optionalTextBounds(dpr1.page, 'メニュー'), null)
      assert.equal(await optionalTextBounds(dpr2.page, 'メニュー'), null)
      assert.ok(Math.abs(narrowMenu1.height - narrowMenu2.height) <= 1)
      await capture(dpr1.page, 'narrow-dpr1')
      await capture(dpr2.page, 'narrow-dpr2')
      assertNoPageErrors(dpr1.pageErrors)
      assertNoPageErrors(dpr2.pageErrors)
    } finally {
      await dpr1.context.close()
      await dpr2.context.close()
    }
  })
} finally {
  await browser?.close()
  await stopServer()
}

if (failures.length > 0) {
  process.stderr.write(`\n${failures.length} browser regression test(s) failed.\n`)
  process.exitCode = 1
} else {
  process.stdout.write('\nAll browser regression tests passed.\n')
}
