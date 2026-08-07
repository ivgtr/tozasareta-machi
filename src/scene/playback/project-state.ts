import { applyEffects } from '../../game/effects'
import type { Effect, GameState, Unit } from '../../game/types'

function cloneUnit(unit: Unit): Unit {
  return { ...unit, apt: { ...unit.apt }, traits: [...unit.traits] }
}

export function projectPlaybackState(
  previous: GameState,
  processedEffects: readonly Effect[],
): GameState {
  const projected = applyEffects(previous, processedEffects)
  const units = previous.units.map(cloneUnit)
  const indexById = new Map(units.map((unit, index) => [unit.id, index]))

  for (const effect of processedEffects) {
    for (const change of effect.unitChanges ?? []) {
      const unitId = change.kind === 'sync' ? change.unit.id : change.unitId
      const index = indexById.get(unitId)
      if (change.kind === 'remove') {
        if (index === undefined) continue
        units.splice(index, 1)
        indexById.clear()
        units.forEach((unit, nextIndex) => indexById.set(unit.id, nextIndex))
        continue
      }
      if (index === undefined) {
        units.push(cloneUnit(change.unit))
        indexById.set(unitId, units.length - 1)
      } else {
        units[index] = cloneUnit(change.unit)
      }
    }
  }

  return { ...projected, units }
}
