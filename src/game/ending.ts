import type { Ending, GameState } from './types'
import { BALANCE } from './data/balance'

export function checkCollapse(state: GameState): boolean {
  const e = BALANCE.ending
  return (
    state.resources.morale <= e.collapseMorale || state.flags.casualties >= e.collapseCasualties
  )
}

export function evaluate(state: GameState): Ending {
  const e = BALANCE.ending
  const { power, medical } = state.resources
  const { casualties, cooperation } = state.flags
  if (casualties >= e.sacrificeCasualties) return 'managed_sacrifice'
  if (
    power >= e.fullRecovery.power &&
    medical >= e.fullRecovery.medical &&
    casualties < e.fullRecovery.maxCasualties
  )
    return 'full_recovery'
  if (cooperation >= e.selfGovernanceCoop) return 'self_governance'
  return 'managed_sacrifice'
}
