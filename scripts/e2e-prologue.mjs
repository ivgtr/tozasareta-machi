import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))
const PORT = Number(process.env.PROLOGUE_E2E_PORT ?? 4178)
const BASE_URL = process.env.PROLOGUE_E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`
const APP_URL = `${BASE_URL.replace(/\/$/, '')}/?e2e=1&story=hold`
const BRIDGE = '__TOZASARETA_MACHI_E2E__'
let server = null

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function startServer() {
  if (process.env.PROLOGUE_E2E_BASE_URL) return
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

async function clickText(page, text, exact = true) {
  const bounds = await textBounds(page, text, exact)
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function tapText(page, text, exact = true) {
  const bounds = await textBounds(page, text, exact)
  await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function waitForScene(page, key) {
  await page.waitForFunction(
    ({ bridge, scene }) => globalThis[bridge]?.snapshot().activeScenes.includes(scene),
    { bridge: BRIDGE, scene: key },
  )
}

async function openGame(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1280, height: 720 },
    hasTouch: options.hasTouch ?? false,
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
  await context.addInitScript(() => {
    Object.defineProperty(globalThis, 'confirm', {
      configurable: true,
      value: () => true,
    })
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction((bridge) => Boolean(globalThis[bridge]), BRIDGE)
  return { context, page, pageErrors }
}

function assertNoErrors(errors) {
  assert.deepEqual(errors, [], 'browser emitted an uncaught error')
}

await startServer()
let browser
try {
  browser = await chromium.launch({ headless: true })

  process.stdout.write('• New Game → Prologue → DAY 1 をkeyboardで進行する\n')
  {
    const { context, page, pageErrors } = await openGame(browser)
    await clickText(page, '▶ 指揮所へ')
    await waitForScene(page, 'Story')
    assert.ok(await textBounds(page, '町は孤立した'))
    await page.keyboard.press('Enter')
    assert.ok(await textBounds(page, '救援まで', false))
    assert.ok(await textBounds(page, '真壁史子  /  町長'))
    await page.keyboard.press('Enter')
    assert.ok(await textBounds(page, '指揮を引き継ぐ'))
    await page.keyboard.press('Enter')
    await waitForScene(page, 'Play')
    await page.waitForFunction((bridge) => {
      const state = globalThis[bridge]?.snapshot()
      return state?.day === 1 && state.phase === 'planning' && state.historyLength === 0
    }, BRIDGE)

    await page.keyboard.press('KeyM')
    await clickText(page, 'タイトルに戻る')
    await waitForScene(page, 'Title')
    await clickText(page, '▶ 続きから')
    await waitForScene(page, 'Play')
    const activeScenes = await page.evaluate(
      (bridge) => globalThis[bridge].snapshot().activeScenes,
      BRIDGE,
    )
    assert.equal(activeScenes.includes('Story'), false, 'resume must not replay the prologue')
    assertNoErrors(pageErrors)
    await context.close()
  }

  process.stdout.write('• narrow touch / reduced-motionでもPrologueを完走する\n')
  {
    const { context, page, pageErrors } = await openGame(browser, {
      viewport: { width: 480, height: 854 },
      hasTouch: true,
    })
    await tapText(page, '▶ 指揮所へ')
    await waitForScene(page, 'Story')
    await tapText(page, '次へ ▶')
    await textBounds(page, '救援まで', false)
    await tapText(page, '次へ ▶')
    await textBounds(page, '指揮を引き継ぐ')
    await tapText(page, 'DAY 1へ ▶')
    await waitForScene(page, 'Play')
    assertNoErrors(pageErrors)
    await context.close()
  }

  process.stdout.write('\nPrologue E2E passed.\n')
} finally {
  await browser?.close()
  await stopServer()
}
