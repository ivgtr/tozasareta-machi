import Phaser from 'phaser'
import type { Aptitude, GameState, Unit } from '../../game/types'
import { artSpec } from '../art/manifest'
import { resolveToken } from '../town/token-resolve'
import { COLORS, colorCss, colorNum, fitSize } from '../tokens'
import { unitVisualState } from '../unit-visual'
import { pixelText } from './pixel-text'

export const TOKEN_SIZE = { width: 36, height: 48 } as const
export const TOKEN_HIT = 44
export const DRAG_THRESHOLD = 8

export interface UnitTokenOptions {
  scale?: number
  variant?: 'tray' | 'town'
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
  private readonly bodyView: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics
  private readonly glyphText: Phaser.GameObjects.Text | null
  private readonly badge: Phaser.GameObjects.Text
  private readonly outline: Phaser.GameObjects.Graphics
  private readonly displayW: number
  private readonly displayH: number
  private readonly bodyColor: number
  private readonly town: boolean
  private selected = false

  constructor(scene: Phaser.Scene, unit: Unit, options: UnitTokenOptions = {}) {
    super(scene)
    const scale = options.scale ?? 1
    this.town = options.variant === 'town'
    this.displayW = TOKEN_SIZE.width * scale
    this.displayH = TOKEN_SIZE.height * scale
    this.unitId = unit.id
    const spec = artSpec('portrait', unit.portrait)
    this.bodyColor = spec ? colorNum(spec.color) : COLORS.inkDim
    const resolution = resolveToken(unit.portrait, (k) => scene.textures.exists(k))
    if (resolution.kind === 'token' && resolution.key) {
      const img = scene.add.image(0, 0, resolution.key)
      const src = img.texture.getSourceImage() as { width: number; height: number }
      const fit = fitSize(src.width, src.height, this.displayW, this.displayH)
      img.setDisplaySize(fit.width, fit.height)
      img.setPosition(0, (this.displayH - fit.height) / 2)
      this.bodyView = img
      this.glyphText = null
    } else {
      const g = scene.add.graphics()
      this.bodyView = g
      this.glyphText = pixelText(scene, spec?.glyph ?? '人', {
        fontSize: Math.round(20 * scale),
        color: this.bodyColor,
      })
      this.glyphText.setPosition(0, 2)
      this.glyphText.setOrigin(0.5)
    }
    this.badge = pixelText(scene, '', {
      fontSize: Math.round(12 * scale),
      color: COLORS.night900,
      backgroundColor: colorCss(COLORS.frameLo),
    })
    this.badge.setPosition(this.displayW / 2 - 2, -this.displayH / 2 + 2)
    this.badge.setOrigin(1, 0)
    this.outline = scene.add.graphics()
    const children: Phaser.GameObjects.GameObject[] = [this.outline, this.bodyView]
    if (this.glyphText) children.push(this.glyphText)
    children.push(this.badge)
    this.add(children)
    this.setSize(TOKEN_HIT, TOKEN_HIT)
    this.setInteractive()
    scene.add.existing(this)
    this.updateUnit(unit)
  }

  private drawGlyphBody(g: Phaser.GameObjects.Graphics, unit: Unit): void {
    const w = this.displayW
    const h = this.displayH
    const border = this.town ? 1 : 2
    const edge = unit.condition === 'injured' ? COLORS.red : this.bodyColor
    if (this.town) {
      g.fillStyle(this.bodyColor, 0.12)
      g.fillRect(-w / 2, -h / 2, w, h)
      g.lineStyle(border, edge, 0.8)
      g.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2)
    } else {
      g.fillStyle(this.bodyColor, 0.25)
      g.fillRect(-w / 2, -h / 2, w, h)
      g.lineStyle(border, edge)
      g.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2)
    }
  }

  updateUnit(unit: Unit): void {
    const visual = unitVisualState(unit)
    if (this.bodyView instanceof Phaser.GameObjects.Image) {
      if (visual.condition === 'injured') this.bodyView.setTint(COLORS.red)
      else this.bodyView.clearTint()
    } else {
      this.bodyView.clear()
      this.drawGlyphBody(this.bodyView, unit)
      this.glyphText?.setColor(
        colorCss(visual.condition === 'injured' ? COLORS.red : this.bodyColor),
      )
    }
    this.badge.setText(APT_SHORT[visual.topAptitude])
    this.badge.setBackgroundColor(colorCss(APT_COLOR[visual.topAptitude]))
  }

  setSelected(value: boolean): void {
    this.selected = value
    this.outline.clear()
    if (value) {
      this.outline.lineStyle(3, COLORS.gold)
      this.outline.strokeRect(
        -this.displayW / 2 - 3,
        -this.displayH / 2 - 3,
        this.displayW + 6,
        this.displayH + 6,
      )
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
  const have = new Map((host.list as UnitToken[]).map((t) => [t.unitId, t] as [string, UnitToken]))
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
