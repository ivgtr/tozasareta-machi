import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))
const PORT = Number(process.env.PROD_SMOKE_PORT ?? 4174)
const BASE_URL = `http://127.0.0.1:${PORT}`

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
  throw new Error(`Vite preview did not start: ${BASE_URL}`)
}

async function stopServer() {
  if (!server || server.exitCode !== null) return
  server.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    delay(2_000).then(() => server?.kill('SIGKILL')),
  ])
}

try {
  const vite = path.join(PROJECT_ROOT, 'node_modules/vite/bin/vite.js')
  server = spawn(
    process.execPath,
    [vite, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  server.stdout?.on('data', (chunk) => process.stdout.write(chunk))
  server.stderr?.on('data', (chunk) => process.stderr.write(chunk))
  await waitForServer()

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ locale: 'ja-JP', colorScheme: 'dark' })
  const pageErrors = []
  const failedRequests = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}`))

  const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  assert.equal(response?.ok(), true, 'production index did not return a successful response')
  await page.waitForSelector('canvas', { state: 'visible' })
  await page.waitForFunction(() => {
    const canvas = globalThis.document?.querySelector('canvas')
    return canvas && canvas.width > 0 && canvas.height > 0
  })

  assert.deepEqual(pageErrors, [], 'production build emitted an uncaught browser error')
  assert.deepEqual(failedRequests, [], 'production build had failed network requests')
  process.stdout.write('Production build smoke test passed.\n')
} finally {
  await browser?.close()
  await stopServer()
}
