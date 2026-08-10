import type Phaser from 'phaser'
import type { Rect } from '../regions'
import type { FacilityId } from './layout'
import type { PlayTownViewportController } from './play-scene-viewport'
import type { TownViewportPoint, TownViewportTransform } from './viewport'

const PAN_THRESHOLD = 8
const WHEEL_DELTA_LIMIT = 240
const WHEEL_ZOOM_RATE = 0.0015

interface TownViewportInputCallbacks {
  canInteract(): boolean
  onFacilityTap(id: FacilityId): void
  onGestureStart(): void
}

interface PrimaryGesture {
  pointerId: number
  facility: FacilityId | null
  startX: number
  startY: number
  lastX: number
  lastY: number
  moved: boolean
}

interface PinchGesture {
  pointerIds: Set<number>
  startDistance: number
  startCenter: TownViewportPoint
  startTransform: TownViewportTransform
}

export class TownViewportInputController {
  private region: Rect | null = null
  private enabled = false
  private primary: PrimaryGesture | null = null
  private pinch: PinchGesture | null = null
  private readonly suppressedPointers = new Set<number>()

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly viewport: PlayTownViewportController,
    private readonly callbacks: TownViewportInputCallbacks,
  ) {}

  setRegion(region: Rect): void {
    this.region = region
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.cancel()
  }

  pointerDown(pointer: Phaser.Input.Pointer, facility: FacilityId | null = null): boolean {
    this.suppressedPointers.delete(pointer.id)
    if (!this.canInteract()) return false

    const touches = this.activeTownTouches()
    if (touches.length >= 2) return this.startPinch(touches)
    if (!this.contains(pointer.worldX, pointer.worldY)) return false
    if (pointer.id === 0 && pointer.button !== 0) return false
    if (this.primary?.pointerId === pointer.id) {
      if (facility) this.primary.facility = facility
      return true
    }

    this.primary = {
      pointerId: pointer.id,
      facility,
      startX: pointer.worldX,
      startY: pointer.worldY,
      lastX: pointer.worldX,
      lastY: pointer.worldY,
      moved: false,
    }
    return true
  }

  pointerMove(pointer: Phaser.Input.Pointer): boolean {
    if (!this.canInteract()) {
      this.cancel()
      return false
    }

    const touches = this.activeTownTouches()
    if (touches.length >= 2) {
      if (!this.pinch && !this.startPinch(touches)) return false
      this.updatePinch(touches)
      return true
    }
    if (this.pinch || this.suppressedPointers.has(pointer.id)) return true

    const primary = this.primary
    if (!primary || primary.pointerId !== pointer.id || !pointer.isDown) return false

    const dx = pointer.worldX - primary.lastX
    const dy = pointer.worldY - primary.lastY
    const moved = Math.hypot(pointer.worldX - primary.startX, pointer.worldY - primary.startY)
    if (!primary.moved && moved > PAN_THRESHOLD) primary.moved = true
    primary.lastX = pointer.worldX
    primary.lastY = pointer.worldY
    if (primary.moved) this.viewport.panBy(dx, dy)
    return primary.moved
  }

  pointerUp(pointer: Phaser.Input.Pointer): boolean {
    if (this.pinch?.pointerIds.has(pointer.id)) {
      this.suppressRemainingTouches(pointer.id)
      this.pinch = null
      this.primary = null
      return true
    }
    if (this.suppressedPointers.delete(pointer.id)) return true

    const primary = this.primary
    if (!primary || primary.pointerId !== pointer.id) return false
    this.primary = null
    if (!primary.moved && primary.facility && this.canInteract()) {
      this.callbacks.onFacilityTap(primary.facility)
    }
    return true
  }

  wheel(pointer: Phaser.Input.Pointer, deltaY: number): boolean {
    if (!this.canInteract() || !this.contains(pointer.worldX, pointer.worldY)) return false
    const delta = Math.max(-WHEEL_DELTA_LIMIT, Math.min(WHEEL_DELTA_LIMIT, deltaY))
    return this.viewport.zoomAt(pointer.worldX, pointer.worldY, Math.exp(-delta * WHEEL_ZOOM_RATE))
  }

  cancel(): void {
    this.primary = null
    this.pinch = null
    this.suppressedPointers.clear()
  }

  private canInteract(): boolean {
    return this.enabled && this.viewport.canManipulate && this.callbacks.canInteract()
  }

  private startPinch(touches: Phaser.Input.Pointer[]): boolean {
    const first = touches[0]
    const second = touches[1]
    if (!first || !second) return false

    this.callbacks.onGestureStart()
    this.primary = null
    this.pinch = {
      pointerIds: new Set([first.id, second.id]),
      startDistance: Math.max(1, distance(first, second)),
      startCenter: midpoint(first, second),
      startTransform: this.viewport.currentTransform(),
    }
    return true
  }

  private updatePinch(touches: Phaser.Input.Pointer[]): void {
    const pinch = this.pinch
    const first = touches[0]
    const second = touches[1]
    if (!pinch || !first || !second) return

    this.viewport.applyGesture(
      pinch.startTransform,
      pinch.startCenter,
      midpoint(first, second),
      distance(first, second) / pinch.startDistance,
    )
  }

  private suppressRemainingTouches(releasedPointerId: number): void {
    this.suppressedPointers.add(releasedPointerId)
    for (const pointer of this.activeTownTouches()) {
      if (pointer.id !== releasedPointerId) this.suppressedPointers.add(pointer.id)
    }
  }

  private activeTownTouches(): Phaser.Input.Pointer[] {
    return [this.scene.input.pointer1, this.scene.input.pointer2].filter(
      (pointer) => pointer.isDown && this.contains(pointer.worldX, pointer.worldY),
    )
  }

  private contains(x: number, y: number): boolean {
    const region = this.region
    if (!region) return false
    const withinX = x >= region.x && x <= region.x + region.width
    const withinY = y >= region.y && y <= region.y + region.height
    return withinX && withinY
  }
}

function midpoint(a: Phaser.Input.Pointer, b: Phaser.Input.Pointer): TownViewportPoint {
  return {
    x: (a.worldX + b.worldX) / 2,
    y: (a.worldY + b.worldY) / 2,
  }
}

function distance(a: Phaser.Input.Pointer, b: Phaser.Input.Pointer): number {
  return Math.hypot(a.worldX - b.worldX, a.worldY - b.worldY)
}
