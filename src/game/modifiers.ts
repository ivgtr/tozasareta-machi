import type { Modifier, TaskId } from './types'

export function queryMult(mods: Modifier[], target: string): number {
  let result = 1
  for (const m of mods) {
    for (const e of m.effects) {
      if (e.target !== target) continue
      if (e.op === 'set') return e.value
      if (e.op === 'mult') result *= e.value
    }
  }
  return result
}

export function queryAdd(mods: Modifier[], target: string): number {
  let result = 0
  for (const m of mods) {
    for (const e of m.effects) {
      if (e.target === target && e.op === 'add') result += e.value
    }
  }
  return result
}

export function isTaskDisabled(mods: Modifier[], task: TaskId): boolean {
  return queryMult(mods, `produce:${task}`) === 0
}

export function tickModifiers(mods: Modifier[], day: number): Modifier[] {
  return mods
    .map((m) => (day > m.startDay ? { ...m, daysLeft: m.daysLeft - 1 } : m))
    .filter((m) => m.daysLeft > 0)
}

export function addModifier(mods: Modifier[], mod: Modifier): Modifier[] {
  const existing = mods.findIndex((m) => m.id === mod.id)
  if (existing >= 0) {
    const next = [...mods]
    next[existing] = mod
    return next
  }
  return [...mods, mod]
}
