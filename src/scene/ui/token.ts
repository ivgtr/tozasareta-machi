import Phaser from 'phaser'
import type { Aptitude, GameState, Unit } from '../../game/types'
import { tokenTextureKey } from '../town/token-resolve'
import { COLORS, colorCss } from '../tokens'
import { unitVisualState } from '../unit-visual'
import { pixelText } from './pixel-text'

export const TOKEN_SIZE = { width: 24, height: 32 } as const
export const TOKEN_HIT = 44
export const DRAG_THRESHOLD = 8

export interface UnitTokenOptions {
  scale?: number
}

const APT_SHORT: Record<Aptitude, string> = { labor: '労', tech: '技', medical: '医', charm: '魅' }
const APT_COLOR: Record<Aptitude, number> = {
  labor: COLORS.amber,
  tech: COLORS.cyan,
  medical: COLORS.green,
  charm: COLORS.gold,
}

export class UnitToken extends Phaser.GameObjects.Container {
  readonly unitId: string
  private readonly bodyView: Phaser.GameObjects.Image
  private readonly badge: Phaser.GameObjects.Text
  private readonly outline: Phaser.GameObjects.Graphics
  private readonly displayW: number
  private readonly displayH: number
  private selected = false

  constructor(scene: Phaser.Scene, unit: Unit, options: UnitTokenOptions = {}) {
    super(scene)
    const scale = options.scale ?? 1
    this.displayW = TOKEN_SIZE.width * scale
    this.displayH = TOKEN_SIZE.height * scale
    this.unitId = unit.id

    this.outline = scene.add.graphics()

    this.bodyView = scene.add.image(0, -this.displayH / 2, tokenTextureKey(unit.portrait))
    this.bodyView.setDisplaySize(this.displayW, this.displayH)

    this.badge = pixelText(scene, '', {
      fontSize: Math.max(8, Math.round(8 * scale)),
      color: COLORS.night900,
      backgroundColor: colorCss(COLORS.frameLo),
    })
    this.badge.setPosition(this.displayW / 2 + 2, -this.displayH + 1)
    this.badge.setOrigin(1, 0)

    this.add([this.outline, this.bodyView, this.badge])
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
    const visual = unitVisualState(unit)
    if (visual.condition === 'injured') this.bodyView.setTint(COLORS.red)
    else this.bodyView.clearTint()

    this.badge.setText(APT_SHORT[visual.topAptitude])
    this.badge.setBackgroundColor(colorCss(APT_COLOR[visual.topAptitude]))
  }

  setSelected(value: boolean): void {
    this.selected = value
    this.outline.clear()
    if (!value) return

    this.outline.lineStyle(2, COLORS.gold)
    this.outline.strokeRect(
      -this.displayW / 2 - 2,
      -this.displayH - 2,
      this.displayW + 4,
      this.displayH + 4,
    )
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
