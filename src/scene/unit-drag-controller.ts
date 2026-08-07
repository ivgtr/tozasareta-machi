export interface DragPointer {
  worldX: number
  worldY: number
}

export interface DragGhost {
  setPosition(x: number, y: number): void
  setVisible(visible: boolean): void
}

export interface UnitDragOptions {
  threshold: number
  ghost: DragGhost
  canInteract(): boolean
  onTap(unitId: string): void
  onDrop(unitId: string, worldX: number, worldY: number): void
}

export class UnitDragController {
  private pending: { unitId: string; x: number; y: number } | null = null
  private draggingUnitId: string | null = null

  constructor(private readonly options: UnitDragOptions) {}

  pointerDown(unitId: string, worldX: number, worldY: number): void {
    if (!this.options.canInteract()) {
      this.cancel()
      return
    }
    this.pending = { unitId, x: worldX, y: worldY }
  }

  pointerMove(pointer: DragPointer): void {
    if (!this.options.canInteract()) {
      this.cancel()
      return
    }
    if (this.pending) {
      const dx = pointer.worldX - this.pending.x
      const dy = pointer.worldY - this.pending.y
      if (Math.hypot(dx, dy) > this.options.threshold) {
        this.draggingUnitId = this.pending.unitId
        this.pending = null
        this.options.ghost.setVisible(true)
      }
    }
    if (this.draggingUnitId) {
      this.options.ghost.setPosition(pointer.worldX, pointer.worldY)
    }
  }

  pointerUp(pointer: DragPointer): void {
    const draggingUnitId = this.draggingUnitId
    if (draggingUnitId) {
      this.draggingUnitId = null
      this.pending = null
      this.options.ghost.setVisible(false)
      if (this.options.canInteract()) {
        this.options.onDrop(draggingUnitId, pointer.worldX, pointer.worldY)
      }
      return
    }

    const pending = this.pending
    this.pending = null
    if (pending && this.options.canInteract()) {
      this.options.onTap(pending.unitId)
    }
  }

  cancel(): void {
    this.pending = null
    this.draggingUnitId = null
    this.options.ghost.setVisible(false)
  }
}
