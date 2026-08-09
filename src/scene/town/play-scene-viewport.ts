import Phaser from 'phaser'
import { reducedMotion } from '../../store'
import { assignedTask, type PlanState } from '../plan'
import type { FlowPresentationModel } from '../playback/flow-model'
import type { TownPlaybackFx } from '../playback/town-playback-fx'
import { focusedFacilityId, placementUnitId, type PlanningIntent } from '../planning/placement'
import type { PresentationMode } from '../presentation'
import type { Rect } from '../regions'
import { TASK_PRESENTATION } from '../task-presentation'
import { deviceClassOf } from '../layout'
import type { TownLayer } from './town-layer'
import { deriveTownViewport, type TownViewportPreset } from './viewport'

export function derivePlayTownViewportPreset(
  mode: PresentationMode,
  flowModel: FlowPresentationModel | null,
  intent: PlanningIntent,
  plan: PlanState,
): TownViewportPreset {
  const facilityId = focusedFacilityId(intent)
  if (mode === 'facility-focus' && facilityId) {
    return { mode: 'facility-focus', facility: facilityId }
  }
  const unitId = placementUnitId(intent)
  if (mode === 'unit-focus' && unitId) {
    const task = assignedTask(plan, unitId)
    return {
      mode: 'unit-focus',
      facility: task ? TASK_PRESENTATION[task].facility : null,
    }
  }
  if (mode === 'flow' && flowModel?.facility) {
    return { mode: 'playback-target', facility: flowModel.facility }
  }
  if (mode === 'arrival') return { mode: 'playback-target', facility: 'road' }
  return { mode: 'overview' }
}

export class PlayTownViewportController {
  private key: string | null = null

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly town: TownLayer,
    private readonly playbackFx: TownPlaybackFx,
  ) {}

  reset(): void {
    this.key = null
  }

  apply(region: Rect, preset: TownViewportPreset): void {
    const deviceClass = deviceClassOf(window.innerWidth)
    const target = deriveTownViewport(region, deviceClass, preset)
    const facility = 'facility' in preset ? preset.facility : ''
    const key = `${preset.mode}:${facility}:${target.x}:${target.y}:${target.scale}`
    if (key === this.key) return
    this.key = key
    this.scene.tweens.killTweensOf([this.town, this.playbackFx])
    if (reducedMotion() || this.town.scaleX === 1) {
      this.setTransform(target.x, target.y, target.scale)
      return
    }
    this.scene.tweens.add({
      targets: [this.town, this.playbackFx],
      x: target.x,
      y: target.y,
      scaleX: target.scale,
      scaleY: target.scale,
      duration: 280,
      ease: 'Cubic.Out',
    })
  }

  private setTransform(x: number, y: number, scale: number): void {
    this.town.setPosition(x, y)
    this.town.setScale(scale)
    this.playbackFx.setTownTransform(x, y, scale)
  }
}
