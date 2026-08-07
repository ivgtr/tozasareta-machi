import { applyEffects } from '../../game/effects'
import type { Effect, GameState, Unit } from '../../game/types'

const UNIT_STATE_NOTICE_TARGETS = new Set([
  'flag:casualties',
  'flag:injury',
  'flag:heal',
  'flag:growth',
  'flag:desert',
])

function cloneUnit(unit: Unit): Unit {
  return { ...unit, apt: { ...unit.apt }, traits: [...unit.traits] }
}

function mentionedUnitIds(effect: Effect, previous: GameState, final: GameState): string[] {
  if (effect.target.startsWith('unit:')) return [effect.target.slice('unit:'.length)]
  const structural =
    UNIT_STATE_NOTICE_TARGETS.has(effect.target) || effect.source === 'event:expedition'
  if (!structural) return []

  const units = [...previous.units, ...final.units]
  const ids = new Set<string>()
  for (const unit of units) {
    if (effect.reason.includes(unit.name)) ids.add(unit.id)
  }
  return [...ids]
}

/**
 * Playback中の表示stateを、再生済みEffectと確定済みstateから構築する。
 * 数値資源はEffectを逐次適用し、ユニットの加入・帰還・負傷・成長・離脱は
 * 対応する通知Effectが再生された時点で確定stateの内容へ同期する。
 */
export function projectPlaybackState(
  previous: GameState,
  final: GameState,
  processedEffects: readonly Effect[],
): GameState {
  const projected = applyEffects(previous, processedEffects)
  const finalById = new Map(final.units.map((unit) => [unit.id, unit]))
  const units = previous.units.map(cloneUnit)
  const indexById = new Map(units.map((unit, index) => [unit.id, index]))

  for (const effect of processedEffects) {
    for (const unitId of mentionedUnitIds(effect, previous, final)) {
      const finalUnit = finalById.get(unitId)
      const index = indexById.get(unitId)
      if (!finalUnit) {
        if (index === undefined) continue
        units.splice(index, 1)
        indexById.clear()
        units.forEach((unit, nextIndex) => indexById.set(unit.id, nextIndex))
        continue
      }
      if (index === undefined) {
        units.push(cloneUnit(finalUnit))
        indexById.set(unitId, units.length - 1)
      } else {
        units[index] = cloneUnit(finalUnit)
      }
    }
  }

  return { ...projected, units }
}
