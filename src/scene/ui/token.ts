import Phaser from 'phaser'
import type { Aptitude, Unit } from '../../game/types'
import { artSpec } from '../art/manifest'
import { resolveToken } from '../town/token-resolve'
import { COLORS, colorCss, colorNum, fitSize } from '../tokens'

export const TOKEN_SCALE = 1.5
export const TOKEN_SIZE = { width: 36, height: 48 } as const
export const TOKEN_HIT = 44
export const DRAG_THRESHOLD = 8

const APT_ORDER: Aptitude[] = ['labor', 'tech', 'medical', 'charm']
const APT_SHORT: Record<Aptitude, string> = { labor: '労', tech: '技', medical: '医', charm: '魅' }
const APT_COLOR: Record<Aptitude, number> = {
  labor: COLORS.amber,
  tech: COLORS.cyan,
  medical: COLORS.green,
  charm: COLORS.gold,
}

export function topAptitude(unit: Unit): Aptitude {
  return APT_ORDER.reduce(
    (best, a) => (unit.apt[a] > unit.apt[best] ? a : best),
    APT_ORDER[0] as Aptitude,
  )
}

export class UnitToken extends Phaser.GameObjects.Container {
  readonly unitId: string
  private readonly bodyView: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics
  private readonly glyphText: Phaser.GameObjects.Text | null
  private readonly badge: Phaser.GameObjects.Text
  private readonly outline: Phaser.GameObjects.Graphics
  private selected = false

  constructor(scene: Phaser.Scene, unit: Unit) {
    super(scene)
    this.unitId = unit.id
    const spec = artSpec('portrait', unit.portrait)
    const resolution = resolveToken(unit.portrait, (k) => scene.textures.exists(k))
    if (resolution.kind === 'token' && resolution.key) {
      const img = scene.add.image(0, 0, resolution.key)
      const src = img.texture.getSourceImage() as { width: number; height: number }
      const fit = fitSize(src.width, src.height, TOKEN_SIZE.width, TOKEN_SIZE.height)
      img.setDisplaySize(fit.width, fit.height)
      img.setPosition(0, (TOKEN_SIZE.height - fit.height) / 2)
      if (unit.condition === 'injured') img.setTint(COLORS.red)
      this.bodyView = img
      this.glyphText = null
    } else {
      const g = scene.add.graphics()
      this.drawGlyphBody(g, spec ? colorNum(spec.color) : COLORS.inkDim)
      this.bodyView = g
      this.glyphText = scene.add.text(0, 0, spec?.glyph ?? '人', {
        fontFamily: 'DotGothic16',
        fontSize: '20px',
        color: colorCss(spec ? colorNum(spec.color) : COLORS.inkDim),
      })
      this.glyphText.setOrigin(0.5)
    }
    const top = topAptitude(unit)
    this.badge = scene.add.text(TOKEN_SIZE.width / 2, -TOKEN_SIZE.height / 2, APT_SHORT[top], {
      fontFamily: 'DotGothic16',
      fontSize: '12px',
      color: colorCss(COLORS.night900),
      backgroundColor: colorCss(APT_COLOR[top]),
    })
    this.badge.setOrigin(0.5)
    this.outline = scene.add.graphics()
    const children: Phaser.GameObjects.GameObject[] = [this.outline, this.bodyView]
    if (this.glyphText) children.push(this.glyphText)
    children.push(this.badge)
    this.add(children)
    this.setSize(TOKEN_HIT, TOKEN_HIT)
    this.setInteractive()
    scene.add.existing(this)
  }

  private drawGlyphBody(g: Phaser.GameObjects.Graphics, color: number): void {
    g.fillStyle(color, 0.25)
    g.fillRect(-TOKEN_SIZE.width / 2, -TOKEN_SIZE.height / 2, TOKEN_SIZE.width, TOKEN_SIZE.height)
    g.lineStyle(2, color)
    g.strokeRect(
      -TOKEN_SIZE.width / 2 + 1,
      -TOKEN_SIZE.height / 2 + 1,
      TOKEN_SIZE.width - 2,
      TOKEN_SIZE.height - 2,
    )
  }

  setSelected(value: boolean): void {
    this.selected = value
    this.outline.clear()
    if (value) {
      this.outline.lineStyle(3, COLORS.gold)
      this.outline.strokeRect(
        -TOKEN_SIZE.width / 2 - 3,
        -TOKEN_SIZE.height / 2 - 3,
        TOKEN_SIZE.width + 6,
        TOKEN_SIZE.height + 6,
      )
    }
  }

  get isSelected(): boolean {
    return this.selected
  }
}
