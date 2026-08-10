import Phaser from 'phaser'
import type { GameState, Unit } from '../../game/types'
import { tokenTextureKey } from '../town/token-resolve'
import { COLORS } from '../tokens'

export const TOKEN_SIZE = { width: 24, height: 32 } as const
export const TOKEN_HIT = 44
export const DRAG_THRESHOLD = 8

const TOKEN_OUTLINE_OFFSETS = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
] as const

const TOKEN_RIM_OFFSETS = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
] as const

export interface UnitTokenOptions {
  scale?: number
}

export class UnitToken extends Phaser.GameObjects.Container {
  readonly unitId: string
  private readonly bodyView: Phaser.GameObjects.Image
  private readonly markers: Phaser.GameObjects.Graphics
  private readonly displayW: number
  private readonly displayH: number
  private selected = false
  private injured = false

  constructor(scene: Phaser.Scene, unit: Unit, options: UnitTokenOptions = {}) {
    super(scene)
    const scale = options.scale ?? 1
    this.displayW = TOKEN_SIZE.width * scale
    this.displayH = TOKEN_SIZE.height * scale
    this.unitId = unit.id

    const groundShadow = scene.add.graphics()
    groundShadow.fillStyle(0x000000, 0.72)
    groundShadow.fillPoints(
      [
        new Phaser.Geom.Point(-this.displayW / 2, -2 * scale),
        new Phaser.Geom.Point(0, -5 * scale),
        new Phaser.Geom.Point(this.displayW / 2, -2 * scale),
        new Phaser.Geom.Point(0, 2 * scale),
      ],
      true,
    )

    this.markers = scene.add.graphics()

    const texture = tokenTextureKey(unit.portrait)
    const outlineViews = TOKEN_OUTLINE_OFFSETS.map(({ x, y }) => {
      const outline = scene.add.image(x * scale, -this.displayH / 2 + y * scale, texture)
      outline.setDisplaySize(this.displayW, this.displayH)
      outline.setTintFill(COLORS.night900)
      return outline
    })
    const rimViews = TOKEN_RIM_OFFSETS.map(({ x, y }) => {
      const rim = scene.add.image(x * scale, -this.displayH / 2 + y * scale, texture)
      rim.setDisplaySize(this.displayW, this.displayH)
      rim.setTintFill(COLORS.frameLo)
      rim.setAlpha(0.8)
      return rim
    })

    this.bodyView = scene.add.image(0, -this.displayH / 2, texture)
    this.bodyView.setDisplaySize(this.displayW, this.displayH)

    this.add([groundShadow, ...outlineViews, ...rimViews, this.bodyView, this.markers])
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        -TOKEN_HIT / 2,
        -this.displayH / 2 - TOKEN_HIT / 2,
        TOKEN_HIT,
        TOKEN_HIT,
      ),
      Phaser.Geom.Rectangle.Contains,
    )
    scene.add.existing(this)
    this.updateUnit(unit)
  }

  updateUnit(unit: Unit): void {
    this.injured = unit.condition === 'injured'
    this.redrawMarkers()
  }

  setSelected(value: boolean): void {
    this.selected = value
    this.redrawMarkers()
  }

  private redrawMarkers(): void {
    this.markers.clear()
    if (this.selected) {
      this.markers.fillStyle(COLORS.gold)
      this.markers.fillRect(-5, 1, 10, 2)
    }
    if (this.injured) {
      this.markers.fillStyle(COLORS.red)
      this.markers.fillRect(this.displayW / 2 - 2, -this.displayH + 1, 3, 3)
    }
  }

  get isSelected(): boolean {
    return this.selected
  }
}

export interface TokenReconcileOptions {
  unitOptions?: UnitTokenOptions
  onPointerDown: (unitId: string, worldX: number, worldY: number) => void
  onRemoved?: (unitId: string) => void
}

export function reconcileTokens(
  scene: Phaser.Scene,
  host: Phaser.GameObjects.Container,
  state: GameState,
  unitIds: string[],
  options: TokenReconcileOptions,
): { tokens: UnitToken[]; created: UnitToken[] } {
  const wanted = new Set(unitIds)
  for (const child of [...host.list]) {
    const token = child as UnitToken
    if (!wanted.has(token.unitId)) {
      host.remove(token)
      token.destroy()
      options.onRemoved?.(token.unitId)
    }
  }

  const have = new Map((host.list as UnitToken[]).map((token) => [token.unitId, token]))
  const tokens: UnitToken[] = []
  const created: UnitToken[] = []

  for (const id of unitIds) {
    const unit = state.units.find((candidate) => candidate.id === id)
    if (!unit) continue

    const existing = have.get(id)
    if (existing) {
      existing.updateUnit(unit)
      tokens.push(existing)
      continue
    }

    const token = new UnitToken(scene, unit, options.unitOptions)
    token.on(
      'pointerdown',
      (
        pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        options.onPointerDown(id, pointer.worldX, pointer.worldY)
      },
    )
    host.add(token)
    tokens.push(token)
    created.push(token)
  }

  return { tokens, created }
}
