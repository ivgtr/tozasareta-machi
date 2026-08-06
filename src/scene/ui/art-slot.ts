import Phaser from 'phaser'
import { textureKey } from '../art/assets'
import { artSpec, type ArtKind } from '../art/manifest'
import { COLORS, colorNum, fitSize } from '../tokens'
import { pixelText } from './pixel-text'

export interface ArtSlotOptions {
  width: number
  height: number
  glyphSize: number
  fallbackGlyph?: string
}

export function drawArtSlot(
  scene: Phaser.Scene,
  host: Phaser.GameObjects.Container,
  kind: ArtKind,
  id: string,
  cx: number,
  cy: number,
  opts: ArtSlotOptions,
): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
  const key = textureKey(kind, id)
  if (scene.textures.exists(key)) {
    const img = scene.add.image(cx, cy, key)
    const src = img.texture.getSourceImage() as { width: number; height: number }
    const fit = fitSize(src.width, src.height, opts.width, opts.height)
    img.setDisplaySize(fit.width, fit.height)
    img.setPosition(cx, cy + (opts.height - fit.height) / 2)
    host.add(img)
    return img
  }
  const spec = artSpec(kind, id)
  const glyph = pixelText(scene, spec?.glyph ?? opts.fallbackGlyph ?? '？', {
    fontSize: opts.glyphSize,
    color: spec ? colorNum(spec.color) : COLORS.inkDim,
  })
  glyph.setPosition(cx, cy)
  glyph.setOrigin(0.5)
  host.add(glyph)
  return glyph
}
