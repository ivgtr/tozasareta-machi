import type { GameState } from '../../game/types'
import type { AudioDirector } from '../audio/audio-director'
import type { CharacterDeck } from '../character/character-deck'
import type { CharacterDragGhost } from '../character/character-drag-ghost'
import { withRemove, type PlanState } from '../plan'
import type { TownLayer } from '../town/town-layer'
import type { FacilityId } from '../town/layout'
import type { UnitDragController } from '../unit-drag-controller'
import type { FacilityFocus } from './facility-focus'
import {
  assignmentTargetFacilityId,
  deriveFacilityPlacementCandidate,
  focusedFacilityId,
  placementUnitId,
  type PlanningIntent,
} from './placement'

export interface PlanningInteractionContext {
  isBusy: () => boolean
  state: () => GameState
  plan: () => PlanState
  setPlan: (plan: PlanState) => void
  intent: () => PlanningIntent
  setIntent: (intent: PlanningIntent) => void
  refresh: () => void
  audio: AudioDirector
  deck: CharacterDeck
  drag: UnitDragController
  dragGhost: CharacterDragGhost
  town: TownLayer
  facilityFocus: FacilityFocus
}

export class PlanningInteractionController {
  private draggingUnit: string | null = null

  constructor(private readonly ctx: PlanningInteractionContext) {}

  get draggingUnitId(): string | null {
    return this.draggingUnit
  }

  beginUnitDrag(unitId: string, worldX: number, worldY: number): void {
    if (this.ctx.isBusy()) return
    const unit = this.ctx.state().units.find((candidate) => candidate.id === unitId)
    if (!unit) return
    this.ctx.deck.clearKeyboardFocus()
    this.ctx.dragGhost.setUnit(unit)
    this.ctx.drag.pointerDown(unitId, worldX, worldY)
  }

  selectUnit(unitId: string): void {
    if (this.ctx.isBusy()) return
    const targetFacility = assignmentTargetFacilityId(this.ctx.intent())
    if (targetFacility) {
      this.tryPlaceUnit(unitId, targetFacility)
      this.ctx.refresh()
      return
    }

    const selected = placementUnitId(this.ctx.intent())
    const deselecting = selected === unitId
    this.ctx.setIntent(deselecting ? { kind: 'none' } : { kind: 'place-unit', unitId })
    this.ctx.audio.play(deselecting ? 'cancel' : 'select')
    this.ctx.refresh()
  }

  facilityTap(id: FacilityId): void {
    if (this.ctx.isBusy()) return
    this.ctx.deck.clearKeyboardFocus()
    const unitId = placementUnitId(this.ctx.intent())
    if (unitId) {
      this.tryPlaceUnit(unitId, id)
      this.ctx.refresh()
      return
    }

    const current = focusedFacilityId(this.ctx.intent())
    const opening = current !== id
    this.ctx.setIntent(opening ? { kind: 'inspect-facility', facilityId: id } : { kind: 'none' })
    this.ctx.audio.play(opening ? 'facility' : 'cancel')
    this.ctx.refresh()
  }

  requestFacilityAssignment(facilityId: FacilityId): void {
    if (this.ctx.isBusy()) return
    this.ctx.audio.play('select')
    this.ctx.setIntent({ kind: 'choose-unit-for-facility', facilityId })
    this.ctx.refresh()
  }

  reassignUnit(unitId: string): void {
    if (this.ctx.isBusy()) return
    this.ctx.audio.play('select')
    this.ctx.setIntent({ kind: 'place-unit', unitId })
    this.ctx.refresh()
  }

  unassignUnit(unitId: string): void {
    if (this.ctx.isBusy()) return
    this.ctx.setPlan(withRemove(this.ctx.plan(), unitId))
    if (placementUnitId(this.ctx.intent()) === unitId) this.ctx.setIntent({ kind: 'none' })
    this.ctx.audio.play('unassign')
    this.ctx.refresh()
  }

  dragStarted(unitId: string): void {
    this.draggingUnit = unitId
    this.ctx.refresh()
  }

  updateDragTarget(unitId: string, worldX: number, worldY: number): void {
    const assignmentFacility = this.ctx.facilityFocus.assignmentFacilityAtWorld(worldX, worldY)
    if (assignmentFacility) {
      const candidate = this.candidate(unitId, assignmentFacility)
      this.ctx.facilityFocus.setAssignmentDropHover(isPlaceable(candidate.kind))
      this.ctx.town.clearPlacementDropTarget()
      return
    }

    this.ctx.facilityFocus.setAssignmentDropHover(null)
    const facility = this.ctx.town.facilityAtWorld(worldX, worldY)
    if (!facility) {
      this.ctx.town.clearPlacementDropTarget()
      return
    }
    const candidate = this.candidate(unitId, facility)
    this.ctx.town.setPlacementDropTarget(facility, isPlaceable(candidate.kind))
  }

  clearDragTarget(): void {
    this.draggingUnit = null
    this.ctx.town.clearPlacementDropTarget()
    this.ctx.facilityFocus.setAssignmentDropHover(null)
  }

  resolveDrop(unitId: string, worldX: number, worldY: number): void {
    if (this.ctx.isBusy()) return
    const assignmentFacility = this.ctx.facilityFocus.assignmentFacilityAtWorld(worldX, worldY)
    if (assignmentFacility) {
      this.tryPlaceUnit(unitId, assignmentFacility)
      return
    }

    const facility = this.ctx.town.facilityAtWorld(worldX, worldY)
    if (facility) {
      this.tryPlaceUnit(unitId, facility)
      return
    }
    if (this.ctx.deck.containsWorld(worldX, worldY)) this.unassignUnitWithoutRefresh(unitId)
  }

  private candidate(unitId: string, facility: FacilityId) {
    return deriveFacilityPlacementCandidate(this.ctx.state(), this.ctx.plan(), unitId, facility)
  }

  private tryPlaceUnit(unitId: string, facility: FacilityId): boolean {
    const candidate = this.candidate(unitId, facility)
    if (!isPlaceable(candidate.kind)) {
      this.ctx.audio.play('invalid')
      return false
    }
    if (candidate.kind !== 'available' && candidate.kind !== 'current') return false
    this.ctx.setPlan(candidate.nextPlan)
    this.ctx.setIntent({ kind: 'inspect-facility', facilityId: facility })
    this.ctx.audio.play('assign')
    return true
  }

  private unassignUnitWithoutRefresh(unitId: string): void {
    this.ctx.setPlan(withRemove(this.ctx.plan(), unitId))
    if (placementUnitId(this.ctx.intent()) === unitId) this.ctx.setIntent({ kind: 'none' })
    this.ctx.audio.play('unassign')
  }
}

function isPlaceable(kind: string): boolean {
  return kind === 'available' || kind === 'current'
}
