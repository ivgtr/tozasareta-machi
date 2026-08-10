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
const MIN_TOUCH_TARGET = 44

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
  hasTouch = false,
} = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    hasTouch,
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
              value: JSON.stringify({ animations, sound: false }),
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

async function firstUnitBounds(page) {
  const handle = await page.waitForFunction(
    (name) => globalThis[name]?.firstUnitBounds() ?? false,
    BRIDGE,
  )
  return handle.jsonValue()
}

async function facilityArtPoint(page, id) {
  const handle = await page.waitForFunction(
    ({ name, facility }) => globalThis[name]?.facilityArtPoint(facility) ?? false,
    { name: BRIDGE, facility: id },
  )
  return handle.jsonValue()
}

async function facilityFootprintPoint(page, id) {
  const handle = await page.waitForFunction(
    ({ name, facility }) => globalThis[name]?.facilityFootprintPoint(facility) ?? false,
    { name: BRIDGE, facility: id },
  )
  return handle.jsonValue()
}

async function buttonTarget(page, label) {
  const handle = await page.waitForFunction(
    ({ name, text }) =>
      globalThis[name]?.buttonTargets().find((target) => target.label === text) ?? false,
    { name: BRIDGE, text: label },
  )
  return handle.jsonValue()
}

async function choiceTarget(page, label) {
  const handle = await page.waitForFunction(
    ({ name, text }) =>
      globalThis[name]?.choiceTargets().find((target) => target.label === text) ?? false,
    { name: BRIDGE, text: label },
  )
  return handle.jsonValue()
}

async function townTokenArtPoint(page) {
  const handle = await page.waitForFunction(
    (name) => globalThis[name]?.townTokenArtPoint() ?? false,
    BRIDGE,
  )
  return handle.jsonValue()
}

function centerOf(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

function assertAligned(a, b, message) {
  const aCenter = centerOf(a)
  const bCenter = centerOf(b)
  assert.ok(
    Math.abs(aCenter.x - bCenter.x) <= 1 && Math.abs(aCenter.y - bCenter.y) <= 1,
    `${message}: visual=${JSON.stringify(aCenter)} hit=${JSON.stringify(bCenter)}`,
  )
}

function assertWithinViewport(bounds, viewport, message) {
  assert.ok(
    bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.x + bounds.width <= viewport.width &&
      bounds.y + bounds.height <= viewport.height,
    `${message}: bounds=${JSON.stringify(bounds)} viewport=${JSON.stringify(viewport)}`,
  )
}

async function clickText(page, text, exact = true) {
  const bounds = await textBounds(page, text, exact)
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function tapText(page, text, exact = true) {
  const bounds = await textBounds(page, text, exact)
  await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function clickFirstUnit(page) {
  const bounds = await firstUnitBounds(page)
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function tapFirstUnit(page) {
  const bounds = await firstUnitBounds(page)
  await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function assertMinimumTouchTargets(page) {
  const sizes = await page.evaluate((name) => globalThis[name]?.buttonSizes() ?? [], BRIDGE)
  assert.ok(sizes.length > 0, 'no visible buttons found')
  for (const size of sizes) {
    assert.ok(
      size.width >= MIN_TOUCH_TARGET && size.height >= MIN_TOUCH_TARGET,
      `button target is too small: ${size.width}x${size.height}`,
    )
  }
}

async function assertMinimumChoiceTargets(page) {
  const sizes = await page.evaluate((name) => globalThis[name]?.choiceSizes() ?? [], BRIDGE)
  assert.ok(sizes.length > 0, 'no visible choice targets found')
  for (const size of sizes) {
    assert.ok(
      size.width >= MIN_TOUCH_TARGET && size.height >= MIN_TOUCH_TARGET,
      `choice target is too small: ${size.width}x${size.height}`,
    )
  }
}

async function showFixture(page, fixture) {
  await page.evaluate(({ name, value }) => globalThis[name].showFixture(value), {
    name: BRIDGE,
    value: fixture,
  })
  await page.waitForFunction(
    ({ name, value }) => {
      const state = globalThis[name]?.snapshot()
      const expected = value.endsWith('-result')
        ? 'flow'
        : value.startsWith('event')
          ? 'event'
          : value.startsWith('choice')
            ? 'choice'
            : value
      return state && state.presentationMode === expected
    },
    { name: BRIDGE, value: fixture },
  )
}

async function startNewGame(page) {
  await clickText(page, '▶ 指揮所へ')
  await page.waitForFunction(
    (name) => globalThis[name]?.snapshot().activeScenes.includes('Play'),
    BRIDGE,
  )
}

async function commitWithAutoAssign(page) {
  await clickText(page, '自動配置')
  await clickText(page, '今日を終える ▶')
  const confirm = await optionalTextBounds(page, 'このまま開始')
  if (confirm) await page.mouse.click(confirm.x + confirm.width / 2, confirm.y + confirm.height / 2)
}

async function clickOptional(page, labels) {
  for (const label of labels) {
    const bounds = await optionalTextBounds(page, label)
    if (!bounds) continue
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    return true
  }
  return false
}

async function finishPlayback(page) {
  for (let step = 0; step < 80; step += 1) {
    const state = await snapshot(page)
    if (!state.busy) return

    if (state.presentationMode === 'flow') {
      if (await clickOptional(page, ['結果を送る ▶▶'])) {
        await delay(100)
        continue
      }
    }

    if (state.presentationMode === 'event') {
      if (await clickOptional(page, ['続ける ▶'])) {
        await delay(350)
        continue
      }
    }

    if (state.presentationMode === 'arrival') {
      if (await clickOptional(page, ['町へ戻る ▶', '迎え入れる ▶', '続ける ▶'])) {
        await delay(350)
        continue
      }
    }

    await delay(100)
  }
  throw new Error('Playback did not settle within the expected number of steps')
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
    process.stdout.write('  ✓ passed\n')
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

  await test('タイトルと指揮所メニューをwide/narrowで維持する', async () => {
    await withGame('global-presentation-wide', {}, async (page) => {
      await textBounds(page, '孤立した町の30日間')
      assert.ok(await optionalTextBounds(page, 'サウンド OFF'))
      await clickText(page, 'サウンド OFF')
      await page.waitForFunction((name) => globalThis[name]?.snapshot().soundEnabled, BRIDGE)
      assert.ok(await optionalTextBounds(page, 'サウンド ON'))
      await clickText(page, 'サウンド ON')
      await page.waitForFunction((name) => !globalThis[name]?.snapshot().soundEnabled, BRIDGE)
      await assertMinimumTouchTargets(page)
      await capture(page, 'title-wide')
      await startNewGame(page)
      await clickText(page, 'メニュー')
      await page.waitForFunction((name) => globalThis[name]?.snapshot().menuOpen, BRIDGE)
      assert.ok(await optionalTextBounds(page, '指揮所メニュー'))
      await assertMinimumTouchTargets(page)
      await capture(page, 'menu-wide')
      await page.keyboard.press('Escape')
      await page.waitForFunction((name) => !globalThis[name]?.snapshot().menuOpen, BRIDGE)
    })

    await withGame(
      'global-presentation-narrow',
      { viewport: { width: 600, height: 900 } },
      async (page) => {
        await textBounds(page, '孤立した町の30日間')
        await assertMinimumTouchTargets(page)
        await capture(page, 'title-narrow')
        await startNewGame(page)
        assert.ok(await optionalTextBounds(page, 'メニュー'))
        await clickText(page, 'メニュー')
        await page.waitForFunction((name) => globalThis[name]?.snapshot().menuOpen, BRIDGE)
        await assertMinimumTouchTargets(page)
        await capture(page, 'menu-narrow')
        await page.keyboard.press('Escape')
        await page.waitForFunction((name) => !globalThis[name]?.snapshot().menuOpen, BRIDGE)
      },
    )
  })

  await test('配置選択を保ったまま人物詳細を開閉できる', async () => {
    await withGame('character-inspector', {}, async (page) => {
      await startNewGame(page)
      await clickFirstUnit(page)
      await page.waitForFunction((name) => globalThis[name]?.snapshot().placementStatusOpen, BRIDGE)
      await page.waitForFunction(
        (name) => globalThis[name]?.snapshot().presentationMode === 'unit-focus',
        BRIDGE,
      )
      await capture(page, 'placement-status-open')

      await clickText(page, '詳細')
      await page.waitForFunction(
        (name) => globalThis[name]?.snapshot().characterInspectorOpen,
        BRIDGE,
      )
      await capture(page, 'character-inspector-open')
      await page.keyboard.press('Escape')
      await page.waitForFunction(
        (name) => !globalThis[name]?.snapshot().characterInspectorOpen,
        BRIDGE,
      )
      assert.ok(await optionalTextBounds(page, '配置先を選択', false))
      assert.ok(await page.evaluate((name) => globalThis[name]?.snapshot().selectedUnitId, BRIDGE))
    })
  })

  await test('未配置確認モーダルを画面回転後も再配置する', async () => {
    for (const scenario of [
      {
        name: 'wide-to-narrow',
        options: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
        nextViewport: { width: 600, height: 900 },
        nextClass: 'narrow',
      },
      {
        name: 'narrow-to-wide-touch',
        options: {
          viewport: { width: 600, height: 900 },
          deviceScaleFactor: 2,
          hasTouch: true,
        },
        nextViewport: { width: 1280, height: 720 },
        nextClass: 'wide',
      },
    ]) {
      await withGame(`commit-confirm-${scenario.name}`, scenario.options, async (page) => {
        await startNewGame(page)
        await clickText(page, '今日を終える ▶')
        await page.waitForFunction((name) => globalThis[name]?.snapshot().confirmOpen, BRIDGE)
        await page.setViewportSize(scenario.nextViewport)
        await page.waitForFunction(
          ({ name, deviceClass }) => globalThis[name]?.snapshot().deviceClass === deviceClass,
          { name: BRIDGE, deviceClass: scenario.nextClass },
        )
        const target = await buttonTarget(page, '戻って調整')
        assertAligned(target.labelBounds, target.hitBounds, scenario.name)
        assertWithinViewport(target.hitBounds, scenario.nextViewport, scenario.name)
        const point = centerOf(target.hitBounds)
        if (scenario.options.hasTouch) {
          await page.touchscreen.tap(point.x, point.y)
        } else {
          await page.mouse.move(point.x, point.y)
          await page.waitForFunction(
            ({ name, label }) =>
              globalThis[name]
                ?.buttonTargets()
                .some((button) => button.label === label && button.hovered),
            { name: BRIDGE, label: '戻って調整' },
          )
          await page.mouse.click(point.x, point.y)
        }
        await page.waitForFunction((name) => !globalThis[name]?.snapshot().confirmOpen, BRIDGE)
      })
    }
  })

  await test('開いたStory Presentationを画面幅切替後も再配置する', async () => {
    await withGame('story-presentation-resize', {}, async (page) => {
      await startNewGame(page)
      const cases = [
        { fixture: 'event', action: '続ける ▶' },
        { fixture: 'event-incident', action: '続ける ▶' },
        { fixture: 'event-phase4', action: '続ける ▶' },
        { fixture: 'choice', action: '食料を買う' },
        { fixture: 'choice-phase4', action: '備蓄を配る' },
        { fixture: 'arrival', action: '迎え入れる ▶' },
        { fixture: 'ending', action: 'もう一度' },
      ]
      for (const [index, entry] of cases.entries()) {
        await showFixture(page, entry.fixture)
        const narrow = index % 2 === 0
        const viewport = narrow ? { width: 600, height: 900 } : { width: 1280, height: 720 }
        await page.setViewportSize(viewport)
        await page.waitForFunction(
          ({ name, width }) => globalThis[name]?.snapshot().gameSize.width === width,
          { name: BRIDGE, width: narrow ? 480 : 1280 },
        )
        const actionBounds = await textBounds(page, entry.action)
        assertWithinViewport(actionBounds, viewport, `${entry.fixture} after resize`)
      }
    })
  })

  await test('選択肢カードの外形と入力判定をwide/narrow・DPR 1/2で一致させる', async () => {
    for (const options of [
      { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
      { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 },
      { viewport: { width: 600, height: 900 }, deviceScaleFactor: 1, hasTouch: true },
      { viewport: { width: 600, height: 900 }, deviceScaleFactor: 2, hasTouch: true },
    ]) {
      await withGame(
        `choice-hit-${options.viewport.width}-${options.deviceScaleFactor}`,
        options,
        async (page) => {
          await startNewGame(page)
          await showFixture(page, 'choice')
          const target = await choiceTarget(page, '食料を買う')
          const point = {
            x: target.visualBounds.x + target.visualBounds.width - 4,
            y: target.visualBounds.y + target.visualBounds.height - 4,
          }
          if (options.hasTouch) {
            await page.touchscreen.tap(point.x, point.y)
          } else {
            await page.mouse.move(
              target.visualBounds.x - 4,
              target.visualBounds.y + target.visualBounds.height / 2,
            )
            assert.equal((await choiceTarget(page, '食料を買う')).hovered, false)
            await page.mouse.move(
              target.visualBounds.x + target.visualBounds.width / 2,
              target.visualBounds.y - 4,
            )
            assert.equal((await choiceTarget(page, '食料を買う')).hovered, false)
            await page.mouse.move(point.x, point.y)
            await page.waitForFunction(
              ({ name, label }) =>
                globalThis[name]
                  ?.choiceTargets()
                  .some((choice) => choice.label === label && choice.hovered),
              { name: BRIDGE, label: '食料を買う' },
            )
            await page.mouse.click(point.x, point.y)
          }
          await page.waitForFunction(
            (name) => globalThis[name]?.snapshot().phase !== 'choice',
            BRIDGE,
            { timeout: 3_000 },
          )
        },
      )
    }
  })

  await test('タッチ操作で配置状態と人物詳細を開ける', async () => {
    await withGame(
      'touch-character-inspector',
      { viewport: { width: 600, height: 900 }, hasTouch: true },
      async (page) => {
        await startNewGame(page)
        await tapFirstUnit(page)
        await page.waitForFunction(
          (name) => globalThis[name]?.snapshot().presentationMode === 'unit-focus',
          BRIDGE,
        )
        await tapText(page, '詳細')
        await page.waitForFunction(
          (name) => globalThis[name]?.snapshot().characterInspectorOpen,
          BRIDGE,
        )
        await assertMinimumTouchTargets(page)
        await capture(page, 'touch-character-inspector')
      },
    )
  })

  await test('主要Planning操作をキーボードだけで実行できる', async () => {
    await withGame('keyboard-planning', {}, async (page) => {
      await textBounds(page, '孤立した町の30日間')
      await page.keyboard.press('Enter')
      await page.waitForFunction(
        (name) => globalThis[name]?.snapshot().activeScenes.includes('Play'),
        BRIDGE,
      )

      await page.keyboard.press('ArrowRight')
      await page.waitForFunction(
        (name) => globalThis[name]?.snapshot().keyboardFocusedUnitId !== null,
        BRIDGE,
      )
      await capture(page, 'keyboard-roster-focus')
      await page.keyboard.press('Enter')
      await page.waitForFunction((name) => globalThis[name]?.snapshot().placementStatusOpen, BRIDGE)
      await page.keyboard.press('Escape')
      await page.waitForFunction(
        (name) => !globalThis[name]?.snapshot().placementStatusOpen,
        BRIDGE,
      )

      await page.keyboard.press('KeyA')
      await page.waitForFunction(
        (name) => globalThis[name]?.snapshot().plannedAssignments > 0,
        BRIDGE,
      )
      await page.keyboard.press('KeyL')
      await page.waitForFunction((name) => globalThis[name]?.snapshot().logOpen, BRIDGE)
      await page.keyboard.press('Escape')
      await page.waitForFunction((name) => !globalThis[name]?.snapshot().logOpen, BRIDGE)
      await page.keyboard.press('KeyM')
      await page.waitForFunction((name) => globalThis[name]?.snapshot().menuOpen, BRIDGE)
      await page.keyboard.press('KeyM')
      await page.waitForFunction((name) => !globalThis[name]?.snapshot().menuOpen, BRIDGE)
      await page.keyboard.press('Space')
      await page.waitForFunction((name) => globalThis[name]?.snapshot().busy, BRIDGE)
    })
  })

  await test('計画操作と施設フォーカスがPlanning画面で機能する', async () => {
    await withGame('planning-facility', {}, async (page) => {
      await startNewGame(page)
      assert.ok(await optionalTextBounds(page, '配給 通常'))
      assert.ok(await optionalTextBounds(page, '調達 OFF'))
      assert.ok(await optionalTextBounds(page, '自動配置'))
      assert.ok(await optionalTextBounds(page, '今日を終える ▶'))
      await assertMinimumTouchTargets(page)
      await capture(page, 'planning-ui')

      await clickFirstUnit(page)
      await page.waitForFunction(
        (name) => globalThis[name]?.snapshot().presentationMode === 'unit-focus',
        BRIDGE,
      )
      const road = await facilityFootprintPoint(page, 'road')
      await page.mouse.click(road.x, road.y)
      await page.waitForFunction(
        (name) => globalThis[name]?.snapshot().presentationMode === 'facility-focus',
        BRIDGE,
      )
      assert.ok(await optionalTextBounds(page, '道路復旧'))
      assert.ok(await optionalTextBounds(page, '外す'))
      await assertMinimumTouchTargets(page)
      await capture(page, 'facility-focus-road')
      await clickText(page, '外す')
      assert.ok(await textBounds(page, '実行見込  未配置'))
    })
  })

  await test('施設画像とクリック判定がwide/narrow・DPR 1/2で一致する', async () => {
    for (const options of [
      { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
      { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 },
      { viewport: { width: 600, height: 900 }, deviceScaleFactor: 1, hasTouch: true },
      { viewport: { width: 600, height: 900 }, deviceScaleFactor: 2, hasTouch: true },
    ]) {
      await withGame(
        `facility-hit-${options.viewport.width}-${options.deviceScaleFactor}`,
        options,
        async (page) => {
          await startNewGame(page)
          const point = await facilityArtPoint(page, 'hq')
          if (options.hasTouch) {
            await page.touchscreen.tap(point.x, point.y)
          } else {
            assert.equal(await optionalTextBounds(page, '本部'), null)
            await page.mouse.move(point.x, point.y)
            await textBounds(page, '本部')
            await page.mouse.click(point.x, point.y)
          }
          await page.waitForFunction(
            (name) => globalThis[name]?.snapshot().selectedFacility === 'hq',
            BRIDGE,
            { timeout: 3_000 },
          )
          await page.keyboard.press('Escape')
          await page.waitForFunction(
            (name) => globalThis[name]?.snapshot().selectedFacility === null,
            BRIDGE,
          )
          const footprintPoint = await facilityFootprintPoint(page, 'road')
          if (options.hasTouch) {
            await page.touchscreen.tap(footprintPoint.x, footprintPoint.y)
          } else {
            await page.mouse.click(footprintPoint.x, footprintPoint.y)
          }
          await page.waitForFunction(
            (name) => globalThis[name]?.snapshot().selectedFacility === 'road',
            BRIDGE,
            { timeout: 3_000 },
          )
        },
      )
    }
  })

  await test('施設入力の統合後もDnDで人物を配置できる', async () => {
    await withGame('facility-hit-drag', {}, async (page) => {
      await startNewGame(page)
      const source = await firstUnitBounds(page)
      const target = await facilityFootprintPoint(page, 'road')
      await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
      await page.mouse.down()
      await page.mouse.move(target.x, target.y, { steps: 10 })
      await page.mouse.up()
      await page.waitForFunction(
        (name) => globalThis[name]?.snapshot().plannedAssignments === 1,
        BRIDGE,
      )
      await page.waitForFunction(
        (name) => globalThis[name]?.facilityTexture('road') === 'facility/road-working',
        BRIDGE,
      )
      const token = await townTokenArtPoint(page)
      await page.mouse.click(token.x, token.y)
      await page.waitForFunction(
        ({ name, unitId }) => globalThis[name]?.snapshot().selectedUnitId === unitId,
        { name: BRIDGE, unitId: token.unitId },
        { timeout: 3_000 },
      )
    })

    await withGame(
      'town-token-touch',
      { viewport: { width: 600, height: 900 }, deviceScaleFactor: 2, hasTouch: true },
      async (page) => {
        await startNewGame(page)
        await clickText(page, '自動配置')
        const token = await townTokenArtPoint(page)
        await page.touchscreen.tap(token.x, token.y)
        await page.waitForFunction(
          ({ name, unitId }) => globalThis[name]?.snapshot().selectedUnitId === unitId,
          { name: BRIDGE, unitId: token.unitId },
          { timeout: 3_000 },
        )
      },
    )
  })

  await test('Turn Playbackが行動結果を専用Presentationで表示する', async () => {
    await withGame('turn-playback-flow', { animations: true }, async (page) => {
      await startNewGame(page)
      await commitWithAutoAssign(page)
      await page.waitForFunction(
        (name) => globalThis[name]?.snapshot().presentationMode === 'flow',
        BRIDGE,
      )
      assert.ok(await optionalTextBounds(page, '結果を送る ▶▶'))
      assert.ok(await optionalTextBounds(page, 'RESULT', false))
      assert.equal(await optionalTextBounds(page, '今日を終える ▶'), null)
      await assertMinimumTouchTargets(page)
      await capture(page, 'turn-playback-flow-wide')
      await finishPlayback(page)
    })
  })

  await test('reduced-motionのnarrowでもTurn Playbackの情報を維持する', async () => {
    await withGame(
      'turn-playback-flow-narrow',
      { viewport: { width: 600, height: 900 }, animations: false },
      async (page) => {
        await startNewGame(page)
        await commitWithAutoAssign(page)
        await page.waitForFunction(
          (name) => globalThis[name]?.snapshot().presentationMode === 'flow',
          BRIDGE,
        )
        assert.ok(await optionalTextBounds(page, '結果を送る ▶▶'))
        await assertMinimumTouchTargets(page)
        await capture(page, 'turn-playback-flow-narrow')
        await finishPlayback(page)
      },
    )
  })

  await test('Playback重要度をwide/narrow・reduced-motionで単独表示する', async () => {
    for (const layout of [
      { name: 'wide', options: { animations: true } },
      {
        name: 'narrow-reduced-motion',
        options: { viewport: { width: 600, height: 900 }, animations: false, hasTouch: true },
      },
    ]) {
      await withGame(`playback-importance-${layout.name}`, layout.options, async (page) => {
        await startNewGame(page)

        await showFixture(page, 'minor-result')
        assert.ok(await optionalTextBounds(page, '一日の清算'))
        assert.equal(await optionalTextBounds(page, '結果を送る ▶▶'), null)

        await showFixture(page, 'normal-result')
        assert.ok(await optionalTextBounds(page, '発電所の修理'))
        assert.ok(await optionalTextBounds(page, '結果を送る ▶▶'))

        await showFixture(page, 'major-result')
        assert.ok(await optionalTextBounds(page, '重大な変化'))
        assert.ok(await optionalTextBounds(page, '結果を送る ▶▶'))
        await assertMinimumTouchTargets(page)
        await capture(page, `playback-major-${layout.name}`)
      })
    }
  })

  const storyFixtures = [
    { name: 'event', mode: 'event', label: '発電機の故障', action: '続ける ▶' },
    { name: 'event-incident', mode: 'event', label: '道路の再崩落', action: '続ける ▶' },
    { name: 'event-phase4', mode: 'event', label: '台風接近', action: '続ける ▶' },
    { name: 'choice', label: '交易の申し出', action: '食料を買う' },
    {
      name: 'choice-phase4',
      mode: 'choice',
      label: '備蓄の扱い',
      action: '備蓄を配る',
    },
    { name: 'arrival', label: 'シド彦', action: '迎え入れる ▶' },
    { name: 'ending', label: '完全復旧', action: 'もう一度' },
  ]

  for (const fixture of storyFixtures) {
    await test(`${fixture.name}をfixtureからwide/narrowで単独表示する`, async () => {
      for (const layout of [
        { name: 'wide', options: { animations: true } },
        {
          name: 'narrow-reduced-motion',
          options: { viewport: { width: 600, height: 900 }, animations: false, hasTouch: true },
        },
      ]) {
        await withGame(`story-${fixture.name}-${layout.name}`, layout.options, async (page) => {
          await startNewGame(page)
          await showFixture(page, fixture.name)
          const state = await snapshot(page)
          assert.equal(state.presentationMode, fixture.mode ?? fixture.name)
          assert.equal(state.deviceClass, layout.name === 'wide' ? 'wide' : 'narrow')
          assert.ok(await optionalTextBounds(page, fixture.label))
          assert.ok(await optionalTextBounds(page, fixture.action))
          if ((fixture.mode ?? fixture.name) === 'choice') await assertMinimumChoiceTargets(page)
          else await assertMinimumTouchTargets(page)
          await capture(page, `story-${fixture.name}-${layout.name}`)
          if (layout.name === 'wide' && fixture.name === 'choice') {
            await page.keyboard.press('ArrowRight')
            await capture(page, 'story-choice-keyboard-focus-wide')
            await page.keyboard.press('Enter')
            await page.waitForFunction(
              (name) => globalThis[name]?.snapshot().phase !== 'choice',
              BRIDGE,
            )
          }
          if (layout.name === 'wide' && (fixture.mode === 'event' || fixture.name === 'arrival')) {
            await page.keyboard.press('Enter')
            await page.waitForFunction(
              ({ name, mode }) => globalThis[name]?.snapshot().presentationMode !== mode,
              { name: BRIDGE, mode: fixture.mode ?? fixture.name },
            )
          }
        })
      }
    })
  }

  await test('終了後にタイトルを経由して新しいゲームを開始できる', async () => {
    await withGame('restart-after-ending-via-title', {}, async (page) => {
      await startNewGame(page)
      await showFixture(page, 'ending')
      await clickText(page, 'タイトルへ')
      await page.waitForFunction(
        (name) => globalThis[name]?.snapshot().activeScenes.includes('Title'),
        BRIDGE,
      )
      page.once('dialog', (dialog) => void dialog.accept())
      await clickText(page, '▶ 指揮所へ')
      await page.waitForFunction(
        (name) => {
          const value = globalThis[name]?.snapshot()
          return (
            value &&
            value.activeScenes.includes('Play') &&
            value.day === 1 &&
            value.phase === 'planning' &&
            value.presentationMode === 'planning' &&
            !value.busy
          )
        },
        BRIDGE,
        { timeout: 5_000 },
      )
      const state = await snapshot(page)
      assert.equal(state.historyLength, 0)
    })
  })

  await test('Playback中の新規ゲームで再生状態を持ち越さない', async () => {
    await withGame('restart-playback', { animations: true }, async (page) => {
      await startNewGame(page)
      await commitWithAutoAssign(page)
      await page.waitForFunction(
        (name) => globalThis[name]?.snapshot().presentationMode === 'flow',
        BRIDGE,
      )
      await page.evaluate((name) => globalThis[name].restartNewGame(), BRIDGE)
      await page.waitForFunction((name) => {
        const value = globalThis[name]?.snapshot()
        return value && value.day === 1 && value.phase === 'planning' && !value.busy
      }, BRIDGE)
      const state = await snapshot(page)
      assert.equal(state.historyLength, 0)
      await capture(page, 'restart-during-playback')
    })
  })

  await test('確定した進行をリロード後に再開できる', async () => {
    await withGame('reload-save', {}, async (page) => {
      await startNewGame(page)
      await commitWithAutoAssign(page)
      await finishPlayback(page)
      await page.waitForFunction((name) => {
        const value = globalThis[name]?.snapshot()
        return (
          value &&
          value.historyLength > 0 &&
          !value.busy &&
          (value.phase === 'planning' || value.phase === 'choice')
        )
      }, BRIDGE)
      const before = await snapshot(page)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForFunction((name) => Boolean(globalThis[name]), BRIDGE)
      await clickText(page, '▶ 続きから')
      await page.waitForFunction(
        ({ name, day, phase }) => {
          const value = globalThis[name]?.snapshot()
          return (
            value &&
            value.activeScenes.includes('Play') &&
            value.day === day &&
            value.phase === phase
          )
        },
        { name: BRIDGE, day: before.day, phase: before.phase },
      )
      await capture(page, 'resume-after-reload')
    })
  })

  await test('wide/narrow・中間viewport・DPR 1/2で論理寸法を維持する', async () => {
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

      await dpr1.page.setViewportSize({ width: 1024, height: 768 })
      await dpr1.page.waitForFunction((name) => {
        const value = globalThis[name]?.snapshot()
        return value && value.deviceClass === 'wide' && value.gameSize.width === 1280
      }, BRIDGE)
      assert.ok(await optionalTextBounds(dpr1.page, 'メニュー'))
      await capture(dpr1.page, 'wide-intermediate')

      await Promise.all([
        dpr1.page.setViewportSize({ width: 600, height: 900 }),
        dpr2.page.setViewportSize({ width: 600, height: 900 }),
      ])
      await Promise.all(
        [dpr1.page, dpr2.page].map((page) =>
          page.waitForFunction((name) => {
            const value = globalThis[name]?.snapshot()
            return value && value.deviceClass === 'narrow' && value.gameSize.width === 480
          }, BRIDGE),
        ),
      )
      const narrow1 = await snapshot(dpr1.page)
      const narrow2 = await snapshot(dpr2.page)
      const narrowMenu1 = await textBounds(dpr1.page, 'メニュー')
      const narrowMenu2 = await textBounds(dpr2.page, 'メニュー')

      assert.deepEqual(narrow1.gameSize, { width: 480, height: 854 })
      assert.deepEqual(narrow2.gameSize, { width: 480, height: 854 })
      assert.ok(Math.abs(narrowMenu1.height - narrowMenu2.height) <= 1)
      await assertMinimumTouchTargets(dpr1.page)
      await assertMinimumTouchTargets(dpr2.page)
      await capture(dpr1.page, 'narrow-dpr1')
      await capture(dpr2.page, 'narrow-dpr2')

      await dpr1.page.setViewportSize({ width: 390, height: 844 })
      await dpr1.page.waitForFunction((name) => {
        const value = globalThis[name]?.snapshot()
        return value && value.deviceClass === 'narrow' && value.gameSize.width === 480
      }, BRIDGE)
      assert.ok(await optionalTextBounds(dpr1.page, 'メニュー'))
      await capture(dpr1.page, 'narrow-compact')
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
