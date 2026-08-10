import Phaser from 'phaser'
import { reducedMotion } from '../../store'
import { assignedTask, type PlanState } from '../plan'
import type { FlowPresentationModel } from '../playback/flow-model'
import { focusedFacilityId, placementUnitId, type PlanningIntent } from '../planning/placement'
import type { PresentationMode } from '../presentation'
import type { Rect } from '../regions'
import { TASK_PRESENTATION } from '../task-presentation'
import { deviceClassOf, type DeviceClass } from '../layout'
import type { TownLayer } from './town-layer'
import {
  TOWN_MANUAL_ZOOM,
  defaultTownManualViewport,
  deriveTownManualViewport,
  deriveTownViewport,
  panTownViewport,
  townManualViewportFromTransform,
  transformTownViewportGesture,
  type TownViewportPoint,
  type TownViewportPreset,
  type TownViewportTransform,
} from './viewport'

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

export function isManualTownViewportPreset(preset: TownViewportPreset): boolean {
  return preset.mode === 'overview' || preset.mode === 'unit-focus'
}

export class PlayTownViewportController {
  private key: string | null = null
  private region: Rect | null = null
  private deviceClass: DeviceClass = 'wide'
  private preset: TownViewportPreset = { mode: 'overview' }
  private manual = defaultTownManualViewport()

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly town: TownLayer,
  ) {}

  reset(): void {
    this.key = null
  }

  get canManipulate(): boolean {
    return this.region !== null && isManualTownViewportPreset(this.preset)
  }

  get isZoomed(): boolean {
    return this.manual.zoom > TOWN_MANUAL_ZOOM.min
  }

  currentTransform(): TownViewportTransform {
    return {
      x: this.town.x,
      y: this.town.y,
      scale: this.town.scaleX,
    }
  }

  apply(region: Rect, preset: TownViewportPreset): void {
    this.region = region
    this.deviceClass = deviceClassOf(window.innerWidth)
    this.preset = preset
    const target = isManualTownViewportPreset(preset)
      ? deriveTownManualViewport(region, this.deviceClass, this.manual)
      : deriveTownViewport(region, this.deviceClass, preset)
    this.applyTarget(target)
  }

  zoomAt(anchorX: number, anchorY: number, scaleFactor: number): boolean {
    if (!this.canManipulate || !this.region) return false
    const overview = deriveTownViewport(this.region, this.deviceClass, { mode: 'overview' })
    return this.commitManualTransform(
      transformTownViewportGesture(
        this.region,
        this.currentTransform(),
        { x: anchorX, y: anchorY },
        { x: anchorX, y: anchorY },
        scaleFactor,
        overview.scale * TOWN_MANUAL_ZOOM.min,
        overview.scale * TOWN_MANUAL_ZOOM.max,
      ),
    )
  }

  panBy(dx: number, dy: number): boolean {
    if (!this.canManipulate || !this.region || !this.isZoomed) return false
    return this.commitManualTransform(panTownViewport(this.region, this.currentTransform(), dx, dy))
  }

  applyGesture(
    start: TownViewportTransform,
    startAnchor: TownViewportPoint,
    currentAnchor: TownViewportPoint,
    scaleFactor: number,
  ): boolean {
    if (!this.canManipulate || !this.region) return false
    const overview = deriveTownViewport(this.region, this.deviceClass, { mode: 'overview' })
    return this.commitManualTransform(
      transformTownViewportGesture(
        this.region,
        start,
        startAnchor,
        currentAnchor,
        scaleFactor,
        overview.scale * TOWN_MANUAL_ZOOM.min,
        overview.scale * TOWN_MANUAL_ZOOM.max,
      ),
    )
  }

  private commitManualTransform(target: TownViewportTransform): boolean {
    if (!this.region) return false
    const current = this.currentTransform()
    if (
      current.x === target.x &&
      current.y === target.y &&
      current.scale === target.scale
    ) {
      return false
    }

    this.manual = townManualViewportFromTransform(this.region, this.deviceClass, target)
    this.scene.tweens.killTweensOf(this.town)
    this.setTransform(target.x, target.y, target.scale)
    this.key = this.targetKey(target)
    return true
  }

  private applyTarget(target: TownViewportTransform): void {
    const key = this.targetKey(target)
    if (key === this.key) return
    this.key = key
    this.scene.tweens.killTweensOf(this.town)
    if (reducedMotion() || this.town.scaleX === 1) {
      this.setTransform(target.x, target.y, target.scale)
      return
    }
    this.scene.tweens.add({
      targets: this.town,
      x: target.x,
      y: target.y,
      scaleX: target.scale,
      scaleY: target.scale,
      duration: 280,
      ease: 'Cubic.Out',
    })
  }

  private targetKey(target: TownViewportTransform): string {
    const facility = 'facility' in this.preset ? this.preset.facility : ''
    return `${this.preset.mode}:${facility}:${target.x}:${target.y}:${target.scale}`
  }

  private setTransform(x: number, y: number, scale: number): void {
    this.town.setPosition(x, y)
    this.town.setScale(scale)
  }
}
