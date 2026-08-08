import { attachUnitChanges, attachUnitChangesToLast, unitChangesBetween } from '../../game/effects'
import type { Effect, GameState, UnitChange } from '../../game/types'

export function buildPlaybackEffects(
  previous: GameState,
  final: GameState,
  effects: readonly Effect[],
): Effect[] {
  const previousIds = new Set(previous.units.map((unit) => unit.id))
  const changes = unitChangesBetween(previous.units, final.units)
  const immediate: UnitChange[] = []
  const deferred: UnitChange[] = []

  for (const change of changes) {
    if (change.kind === 'remove' || !previousIds.has(change.unit.id)) immediate.push(change)
    else deferred.push(change)
  }

  return attachUnitChangesToLast(attachUnitChanges(effects, immediate), deferred)
}
