import type { RngState } from './types'

function hash(n: number): number {
  let x = n | 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = x ^ (x >>> 16)
  return (x >>> 0) / 4294967296
}

export function nextRandom(rng: RngState): [number, RngState] {
  const mixed = (rng.seed ^ Math.imul(rng.counter + 1, 0x9e3779b9)) | 0
  return [hash(mixed), { seed: rng.seed, counter: rng.counter + 1 }]
}

export function chance(rng: RngState, p: number): [boolean, RngState] {
  const [r, next] = nextRandom(rng)
  return [r < p, next]
}

export function weightedPick<T>(
  items: readonly T[],
  weight: (item: T) => number,
  rng: RngState,
): [T, RngState] | null {
  let total = 0
  for (const item of items) total += Math.max(0, weight(item))
  if (total <= 0 || items.length === 0) return null
  const [r, next] = nextRandom(rng)
  let threshold = r * total
  for (const item of items) {
    threshold -= Math.max(0, weight(item))
    if (threshold < 0) return [item, next]
  }
  const last = items[items.length - 1]
  if (last === undefined) return null
  return [last, next]
}
